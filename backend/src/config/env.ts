import pino from 'pino';
import { z } from 'zod';

// An unset variable and one set to '' mean the same thing in a .env file.
const optionalString = z
  .string()
  .transform((value) => value.trim() || undefined)
  .optional();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  /*
   * The browser origins allowed to call this API — CORS, the Socket.io
   * handshake, and Better Auth's trustedOrigins all read it.
   *
   * A comma-separated list so a tunnelled dev session (ngrok) can run alongside
   * plain localhost without editing the file between them. Entries stay exact
   * origins, never wildcards (AGENTS.md, CORS) — this is a finite allowlist from
   * env, not a pattern match. Each entry is trimmed, so whitespace around a
   * comma can't produce an origin that silently matches nothing.
   */
  FRONTEND_ORIGIN: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  // Better Auth: signing secret (32+ bytes of entropy) and the public base URL
  // the auth handler is served from.
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),

  // The bootstrap admin account. Optional so an existing database and the test
  // suite boot without them; when both are set, boot reconciles the account (see
  // modules/auth/admin-bootstrap.ts). The password floor matches Better Auth's
  // `minPasswordLength` in config/auth.ts — a shorter one would be rejected at
  // creation time, so we fail fast on boot instead.
  ADMIN_EMAIL: optionalString.pipe(z.email().optional()),
  ADMIN_PASSWORD: optionalString.pipe(z.string().min(8).max(128).optional()),
  ADMIN_NAME: z.string().min(1).default('Marty Global Admin'),

  // Amazon SES. Credentials are optional so local dev and tests boot without an
  // AWS account — when they are absent the transport logs instead of sending
  // (see config/ses.ts). Production must set them.
  AWS_REGION: z.string().min(1).default('us-east-1'),
  // Blank is treated as absent so a checked-in .env.example with empty keys
  // still boots.
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  SES_FROM_EMAIL: z.email().default('no-reply@martyglobal.com'),
  SES_FROM_NAME: z.string().min(1).default('Marty Global'),
  SES_REPLY_TO_EMAIL: optionalString.pipe(z.email().optional()),
  SES_CONFIGURATION_SET: optionalString,

  // --- Cloudflare R2 (object storage) -------------------------------------
  // Identity documents, scans, and invoices live here. Buckets are PRIVATE and
  // every file is served as a short-TTL presigned URL minted after an auth +
  // ownership check in the service layer (AGENTS.md, Security & PII) — the
  // browser never receives these credentials.
  //
  // All five are optional so local dev and the test suite boot without an R2
  // account; when they are absent lib/storage.ts presigns to `undefined` and the
  // screens fall back to their pending/disabled states. Production must set them
  // (the refine below enforces all-or-nothing so a half-filled block fails fast).
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  /*
   * Overrides the derived `https://<account>.r2.cloudflarestorage.com` endpoint.
   *
   * Required — not optional — for a bucket created under an R2 JURISDICTION.
   * A EU-jurisdiction bucket is reachable only at
   * `https://<account>.eu.r2.cloudflarestorage.com`; the default hostname answers
   * every request for it with a 403 AccessDenied that looks exactly like a bad
   * key, so it is worth checking here first when uploads suddenly "lose" their
   * credentials. Also how a local S3-compatible stand-in (MinIO) is pointed at.
   */
  R2_ENDPOINT: optionalString.pipe(z.url().optional()),
  // R2 ignores the region but the S3 protocol requires one; 'auto' is
  // Cloudflare's documented value.
  R2_REGION: z.string().min(1).default('auto'),
  // How long a presigned link stays valid. Short by design: these URLs are
  // bearer tokens for PII, so they must expire well before they can be shared.
  R2_PRESIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3600)
    .default(300),

  /*
   * --- Sentry (error monitoring) -----------------------------------------
   *
   * Optional, like SES and R2 above: without a DSN the SDK is never
   * initialised and every capture becomes a no-op, so local dev and the test
   * suite run with no Sentry account and no network calls.
   *
   * The DSN is not a secret in the way a key is — it only permits writing
   * events — but it stays server-side here regardless; the browser gets its own
   * DSN through VITE_SENTRY_DSN in the frontend's .env.
   */
  SENTRY_DSN: optionalString.pipe(z.url().optional()),
  // Tags every event so a staging error is never mistaken for production. The
  // default follows NODE_ENV, which is right for all three of ours.
  SENTRY_ENVIRONMENT: optionalString,
  /*
   * The deployed version an event belongs to — the image tag / commit SHA the
   * deploy exports, not a value baked into the image.
   *
   * Optional: local dev and the test suite have no deploy to name, and a
   * missing release only costs Sentry some grouping quality, so it is not worth
   * refusing to boot over (unlike the production credential refines below).
   */
  SENTRY_RELEASE: optionalString,
  /*
   * Share of transactions sampled for performance tracing, 0–1. Off by default:
   * tracing is a paid quota and this API's throughput would burn it on health
   * checks. Raise deliberately (0.1 is a common production starting point).
   */
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),

  // --- Live chat (Socket.io) ---------------------------------------------
  /*
   * How long a customer's unanswered message waits before we email them.
   *
   * The window exists so an agent who picks the thread up promptly cancels the
   * email simply by replying; too short and the customer gets both a reply and a
   * "we'll get back to you", too long and someone who closed the tab hears
   * nothing for a while.
   */
  SUPPORT_HANDOFF_DELAY_MINUTES: z.coerce.number().int().min(1).max(120).default(5),
  // Inbound socket messages per connection per minute. The socket equivalent of
  // chatRateLimit on the REST side — one posture regardless of transport.
  SUPPORT_SOCKET_MESSAGES_PER_MINUTE: z.coerce.number().int().min(5).max(600).default(60),

  /*
   * How long an anonymous visitor's chat survives after their last message,
   * after which it is deleted outright — the one hard delete in this schema, and
   * a deliberate one (AGENTS.md requires asking first). A pre-sales chat carries
   * no regulatory retention, so keeping it past its usefulness is a liability.
   */
  GUEST_CHAT_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  // How often the purge sweeps, in seconds. Daily is plenty for a 7-day window.
  GUEST_CHAT_PURGE_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(86_400),

  /*
   * Cloudflare Turnstile. The anonymous chat widget is the first endpoint on this
   * backend a bot can reach without a session, so thread creation is verified
   * server-side (AGENTS.md: the browser never calls a third party directly).
   *
   * Optional, like SES and R2 above: without the secret, verification logs a
   * warning and passes through, so local dev and tests need no Cloudflare
   * account. Production must set it — an unverified public write endpoint is a
   * spam queue with extra steps.
   */
  TURNSTILE_SECRET_KEY: optionalString,

  // --- USDT (TRC-20) via TronGrid ----------------------------------------
  // We only ever WATCH the chain: no private key, no seed phrase, no signing
  // (AGENTS.md, Payments). Everything below is public data or a read-only key.
  //
  // Nile is the testnet; tests and local dev must never point at mainnet.
  TRON_NETWORK: z.enum(['mainnet', 'nile']).default('nile'),
  // Read-only TronGrid key (trongrid.io → Dashboard → API Keys). Optional so the
  // app boots without an account — the poller idles instead of failing.
  TRONGRID_API_KEY: optionalString,
  /*
   * The address customers send USDT to. Public receiving address only, base58
   * ('T' + 33 chars). We never hold the key for it.
   *
   * One shared address plus a per-payment amount is deliberate: TRC-20 has no
   * memo/tag field, so the amount IS the discriminator. The service makes each
   * pending amount unique (see payments.service.ts) so a transfer can only ever
   * match one payment.
   */
  TRON_DEPOSIT_ADDRESS: optionalString.pipe(
    z
      .string()
      .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'Must be a base58 TRON address')
      .optional(),
  ),
  // Confirmations before we credit. Tron blocks are ~3s and irreversible after
  // ~19 (one SR round), so 19 is the safe floor rather than a guess.
  TRON_MIN_CONFIRMATIONS: z.coerce.number().int().min(1).max(100).default(19),
  // How often the poller sweeps TronGrid, in seconds.
  TRON_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(10).max(3600).default(30),
  /*
   * USD → USDT rate as an integer numerator over 1_000_000 (USDT's own scale) —
   * never a float (AGENTS.md, Money). 1_000_000 means 1.000000 USDT per USD.
   * A spread is expressed by raising this (e.g. 1_010_000 = +1%).
   */
  USDT_USD_RATE_MINOR: z.coerce.number().int().positive().default(1_000_000),
  // How long a quoted USDT amount + rate stays valid, in minutes. After this the
  // customer must re-quote; a transfer arriving late is held, never auto-credited
  // at a stale rate (AGENTS.md, Money).
  USDT_RATE_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
})
  /*
   * Mainnet is real money. A deployment that points at mainnet without both a
   * receiving address and an API key would poll nothing and silently never
   * credit anyone — fail on boot instead.
   */
  .refine(
    (value) =>
      value.TRON_NETWORK !== 'mainnet' ||
      Boolean(value.TRON_DEPOSIT_ADDRESS && value.TRONGRID_API_KEY),
    {
      path: ['TRON_DEPOSIT_ADDRESS'],
      message:
        'TRON_NETWORK=mainnet requires both TRON_DEPOSIT_ADDRESS and TRONGRID_API_KEY',
    },
  )
  /*
   * R2 is all-or-nothing. A partially filled block would presign nothing while
   * looking configured — customers would see permanently "pending" documents
   * with no error anywhere. Fail on boot instead. R2_ENDPOINT is excluded: it is
   * derived from the account id unless explicitly overridden.
   */
  .refine(
    (value) => {
      const keys = [
        value.R2_ACCOUNT_ID,
        value.R2_ACCESS_KEY_ID,
        value.R2_SECRET_ACCESS_KEY,
        value.R2_BUCKET,
      ];
      return keys.every(Boolean) || keys.every((key) => !key);
    },
    {
      path: ['R2_BUCKET'],
      message:
        'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must all be set together (or all left unset)',
    },
  )
  // Half-configured is a mistake, not a "skip" — a typo'd ADMIN_EMAIL next to a
  // real password would otherwise silently create nothing.
  .refine(
    (value) => Boolean(value.ADMIN_EMAIL) === Boolean(value.ADMIN_PASSWORD),
    {
      path: ['ADMIN_PASSWORD'],
      message:
        'ADMIN_EMAIL and ADMIN_PASSWORD must be set together (or both left unset)',
    },
  )
  /*
   * SES credentials are a complete pair in production. A half-filled or empty
   * block would boot cleanly and then skip every send (config/ses.ts), so a
   * deploy that never delivers a verification email or a payment receipt would
   * look healthy. Dev and test keep them optional.
   */
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    if (!value.AWS_ACCESS_KEY_ID || !value.AWS_SECRET_ACCESS_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['AWS_SECRET_ACCESS_KEY'],
        message:
          'NODE_ENV=production requires both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  /*
   * The one log line this file emits, and the only one in the backend that
   * cannot go through `lib/logger.ts` — that logger is built FROM this module,
   * so importing it here would be a cycle. A bare pino instance keeps the fatal
   * boot line on the same transport as everything else instead of falling back
   * to console (AGENTS.md, Security & PII: no console.log in committed code).
   *
   * Synchronous destination on purpose: `process.exit` below does not flush a
   * buffered stream, and a boot failure that prints nothing is the worst
   * possible version of this path. Field names only — a validation issue never
   * carries the value, so a bad secret cannot be logged.
   */
  pino({ level: 'fatal' }, pino.destination({ dest: 2, sync: true })).fatal(
    { fieldErrors: z.flattenError(parsed.error).fieldErrors },
    'Invalid environment variables',
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

/*
 * The canonical public URL of the frontend — the first FRONTEND_ORIGIN entry.
 *
 * FRONTEND_ORIGIN is an allowlist answering "may this origin call us?", which is
 * the wrong question for an outbound link: an email has to name one URL. Every
 * link we build (notifications, password reset) uses this, so put the origin a
 * real user browses first in the list.
 */
export const publicAppUrl = env.FRONTEND_ORIGIN[0];
