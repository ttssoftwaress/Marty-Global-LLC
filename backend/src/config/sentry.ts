import * as Sentry from '@sentry/node';

import { env } from './env.js';

/*
 * Sentry — error monitoring for the API, the job workers, and the socket server
 * (one process, one client).
 *
 * AGENTS.md, Security & PII: "Never log PII, card data, or webhook secrets —
 * log record ids. Scrub PII in Sentry `beforeSend` in both apps." An error
 * report is a log that leaves the building, so it gets the strictest reading of
 * that rule: this file's job is to make it structurally hard for an identity
 * document, a tax ID, or a session cookie to reach a third-party service.
 *
 * Without SENTRY_DSN nothing is initialised and every Sentry call is a no-op,
 * so dev and tests need no account.
 */

// Header names are lowercased before comparison — Node normalises inbound
// headers, but events can also be built by integrations that do not.
const SCRUBBED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'idempotency-key',
]);

/*
 * Query/body keys whose VALUE is dropped wholesale. Matching is substring and
 * case-insensitive, so `password`, `newPassword`, and `password_confirmation`
 * are all covered by one entry.
 *
 * This list is deliberately broad and deliberately dumb: a false positive costs
 * us one redacted debugging field, while a false negative puts a customer's tax
 * ID in a vendor's database. When adding a field to the schema that carries
 * anything personal, add its key here too.
 */
const SCRUBBED_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'ssn',
  'taxid',
  'tax_id',
  'ein',
  'passport',
  'nationalid',
  'national_id',
  'dateofbirth',
  'date_of_birth',
  'dob',
  'address',
  'street',
  'postcode',
  'postalcode',
  'postal_code',
  'zip',
  'phone',
  'email',
  // Crypto: we never hold a key, so one appearing in an event is a bug worth
  // redacting rather than reading (AGENTS.md, Payments).
  'privatekey',
  'private_key',
  'mnemonic',
  'seedphrase',
  'seed_phrase',
  // Card data must never exist here at all (PCI DSS / SAQ A). Redacting it is a
  // backstop, not a licence to introduce it.
  'card',
  'pan',
  'cvc',
  'cvv',
];

const REDACTED = '[redacted]';

function isSensitiveKey(key: string) {
  const normalised = key.toLowerCase();
  return SCRUBBED_KEY_PATTERNS.some((pattern) => normalised.includes(pattern));
}

/*
 * Walks an arbitrary structure and redacts sensitive values by key name.
 *
 * Depth- and breadth-bounded because this runs on the error path: a deeply
 * nested or self-referential payload must not turn a 500 into a hang. `seen`
 * guards cycles, which Prisma results and Express objects both contain.
 */
function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => scrub(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : scrub(item, depth + 1, seen);
  }
  return result;
}

function scrubRequest(request: NonNullable<Sentry.ErrorEvent['request']>) {
  if (request.headers) {
    for (const key of Object.keys(request.headers)) {
      if (SCRUBBED_HEADERS.has(key.toLowerCase())) {
        request.headers[key] = REDACTED;
      }
    }
  }

  if (request.cookies) request.cookies = { [REDACTED]: REDACTED };

  // A request body is the single most likely place for an ID document's
  // metadata or an address to appear, so it is dropped entirely rather than
  // walked — the URL, method, and stack are what make an error actionable.
  if (request.data !== undefined) request.data = REDACTED;

  if (typeof request.query_string === 'string') {
    request.query_string = scrubQueryString(request.query_string);
  } else if (request.query_string && typeof request.query_string === 'object') {
    request.query_string = scrub(request.query_string) as typeof request.query_string;
  }

  // A presigned R2 URL carries a signature that grants read access to a private
  // document for its whole TTL; the query string is stripped from the URL too.
  if (typeof request.url === 'string') {
    const [path] = request.url.split('?');
    request.url = path;
  }
}

function scrubQueryString(queryString: string) {
  const params = new URLSearchParams(queryString);
  for (const key of [...params.keys()]) {
    if (isSensitiveKey(key)) params.set(key, REDACTED);
  }
  return params.toString();
}

// Exposed for sentry.test.ts only — these are the redaction rules, and they are
// worth pinning with tests rather than trusting by inspection.
export const __testing = { scrub, scrubRequest, isSensitiveKey };

export function initSentry() {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,

    /*
     * Stops the SDK attaching the caller's IP and request headers on its own.
     * Already the default; written explicitly because silently inheriting it
     * would turn a future upgrade that flips the default into a PII leak.
     */
    sendDefaultPii: false,
    // Caps how much of any single string is sent — a truncated value cannot
    // carry a whole document payload into an event.
    maxValueLength: 2048,

    integrations: [
      // Bodies are the highest-risk field on this API (identity documents,
      // addresses, tax IDs), so the Express integration is told never to attach
      // one. beforeSend redacts it again as a backstop.
      Sentry.expressIntegration(),
      Sentry.requestDataIntegration({
        include: {
          data: false,
          cookies: false,
          ip: false,
        },
      }),
    ],

    /*
     * Last line of defence: every event passes through here, whatever produced
     * it (Express, a BullMQ processor, a socket handler, an unhandled
     * rejection).
     */
    beforeSend(event) {
      delete event.user;
      delete event.server_name;

      if (event.request) scrubRequest(event.request);

      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts) {
        event.contexts = scrub(event.contexts) as typeof event.contexts;
      }

      // Breadcrumbs replay what happened before the error — the same payloads,
      // one step earlier.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          data: breadcrumb.data
            ? (scrub(breadcrumb.data) as typeof breadcrumb.data)
            : breadcrumb.data,
        }));
      }

      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      // Query text can embed literal values from a filing or a payment.
      if (breadcrumb.category === 'query') return null;
      return breadcrumb;
    },
  });
}
