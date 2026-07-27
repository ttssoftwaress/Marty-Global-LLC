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
  FRONTEND_ORIGIN: z.url(),
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
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    z.flattenError(parsed.error).fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
