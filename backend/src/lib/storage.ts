import { logger } from './logger.js';

/*
 * Object storage links. Files live in private R2 buckets and are served only as
 * short-TTL presigned URLs, minted after an auth + ownership check in the
 * service layer (AGENTS.md, Security & PII) — which is why this takes an object
 * key and never a URL, and why nothing outside a service may call it.
 *
 * The R2 client is not configured yet (no bucket in config/env.ts). Until it is,
 * presigning resolves to `undefined`: every consumer already treats a missing
 * link as "not available yet" — a scan still processing, a document the team
 * owes us — so the screens render their existing disabled/pending states rather
 * than a broken href. Swapping in the real S3 presigner changes only this file.
 */

export const PRESIGNED_URL_TTL_SECONDS = 300;

export function presignObject(objectKey: string | null | undefined): string | undefined {
  if (!objectKey) return undefined;

  logger.debug({ objectKey }, 'Presign requested before R2 is configured');
  return undefined;
}

export function presignObjects(objectKeys: string[]): string[] {
  return objectKeys
    .map((key) => presignObject(key))
    .filter((url): url is string => Boolean(url));
}
