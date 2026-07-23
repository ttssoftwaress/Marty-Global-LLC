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
});

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
