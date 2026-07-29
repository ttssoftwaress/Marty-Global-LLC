import * as Sentry from '@sentry/react';

/*
 * Sentry — error monitoring for the SPA (marketing, portal, and admin).
 *
 * AGENTS.md, Security & PII: "Scrub PII in Sentry `beforeSend` in both apps."
 * The browser is the surface where PII is most exposed — the customer's own
 * data is on screen, in form state, and in the URL — so the posture here
 * matches the backend's: default-deny, redact by key name, and drop anything
 * whose shape we cannot reason about.
 *
 * Without VITE_SENTRY_DSN nothing is initialised and every Sentry call is a
 * no-op, so `npm run dev` needs no account and no network calls.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/*
 * Value-bearing keys that are redacted wherever they appear. Substring match,
 * case-insensitive — `password` also covers `confirmPassword`.
 *
 * Kept deliberately aligned with backend/src/config/sentry.ts: the two apps
 * share no code (AGENTS.md), so this list is a mirror maintained by hand. When
 * one changes, change the other in the same task.
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

/*
 * Reduces a URL to origin + path, dropping the query string and fragment.
 *
 * A presigned R2 link carries its signature in the query string and is a live
 * bearer token for a private document for its whole TTL, so the query never
 * leaves the browser. The path is kept: it is what identifies the route that
 * broke, and its record ids are meaningless without our database.
 *
 * `globalThis.location` rather than `window` so the module is importable under
 * vitest's node environment.
 */
function scrubUrl(url: string) {
  try {
    const parsed = new URL(url, globalThis.location?.origin ?? 'http://localhost');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return REDACTED;
  }
}

// Exposed for sentry.test.ts only — these are the redaction rules, and they
// mirror the backend's by hand (the two apps share no code), so both sides are
// pinned with tests to keep them from drifting apart.
export const __testing = { scrub, scrubUrl, isSensitiveKey };

export function initSentry() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE,
    // Vite inlines this at build time; it ties an event to the deploy that
    // produced it.
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,

    /*
     * `sendDefaultPii: false` keeps the SDK from attaching the IP address and
     * request headers on its own. Written explicitly rather than inherited so
     * an upgrade that changes the default cannot quietly start sending it.
     */
    sendDefaultPii: false,

    // Tracing is off by default — it is a paid quota, and route timings are not
    // what this app needs monitoring for yet. Raise deliberately.
    tracesSampleRate: 0,

    /*
     * Default integrations only — explicitly NO Session Replay.
     *
     * Replay records the DOM, and on these screens that is the customer's
     * address, their scanned mail, and their filing answers. Even with
     * `maskAllText` it is the wrong default for a product holding identity
     * documents, so it is left out entirely rather than configured cautiously.
     * Do not add `replayIntegration()` here without a decision to match.
     *
     * Console and DOM breadcrumbs are dropped in `beforeBreadcrumb` below.
     */

    beforeSend(event) {
      // Identity is set explicitly by setSentryUser() below — never inferred by
      // the SDK, and never more than an id.
      if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : {};
      }

      if (event.request) {
        if (event.request.url) event.request.url = scrubUrl(event.request.url);
        delete event.request.query_string;
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
      }

      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts) {
        event.contexts = scrub(event.contexts) as typeof event.contexts;
      }

      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      /*
       * A `console` breadcrumb replays whatever was logged, and a `ui.click`
       * breadcrumb records the text content of the element clicked — on these
       * screens that is a customer's own name, address, or mail subject.
       */
      if (breadcrumb.category === 'console') return null;
      if (breadcrumb.category?.startsWith('ui.')) return null;

      /*
       * A fetch/xhr breadcrumb carries the full request URL. These are portal
       * API calls, so the path holds record ids and the query string can hold a
       * presigned link — keep the endpoint, drop the rest.
       */
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        const url: unknown = breadcrumb.data?.url;
        if (typeof url === 'string') {
          breadcrumb.data = { ...breadcrumb.data, url: scrubUrl(url) };
        }
        return breadcrumb;
      }

      // Navigation breadcrumbs are the customer's path through their own
      // records; the same URL rule applies to both ends of the hop.
      if (breadcrumb.category === 'navigation') {
        const { from, to } = (breadcrumb.data ?? {}) as {
          from?: string;
          to?: string;
        };
        breadcrumb.data = {
          ...breadcrumb.data,
          ...(from ? { from: scrubUrl(from) } : {}),
          ...(to ? { to: scrubUrl(to) } : {}),
        };
        return breadcrumb;
      }

      return breadcrumb;
    },
  });
}

/*
 * Ties an event to an account by id ONLY — never email or name, which is what
 * Sentry's user object is normally filled with.
 *
 * An id is enough to look the customer up in our own database, and it does not
 * put an address book in a third party's index.
 */
export function setSentryUser(userId: string | undefined) {
  if (!DSN) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
