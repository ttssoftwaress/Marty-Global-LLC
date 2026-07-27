import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env.js';
import { logger } from './logger.js';

/*
 * Object storage. Files live in private R2 buckets and are served only as
 * short-TTL presigned URLs, minted after an auth + ownership check in the
 * service layer (AGENTS.md, Security & PII) — which is why every function here
 * takes an object KEY and never a URL, and why nothing outside a service may
 * call it.
 *
 * Uploads never round-trip through the API process: a service mints a presigned
 * PUT, the browser sends the bytes straight to R2, and only the resulting key
 * comes back as JSON. The key is built HERE from the server's own inputs — a
 * client-supplied path could otherwise overwrite another customer's document.
 *
 * When R2 is unconfigured (local dev, CI) every presign resolves to `undefined`.
 * Consumers already treat a missing link as "not available yet", so the screens
 * render their existing disabled/pending states rather than a broken href.
 */

export const PRESIGNED_URL_TTL_SECONDS = env.R2_PRESIGNED_URL_TTL_SECONDS;

// All four are required together (config/env.ts refines this), so the bucket
// alone answers "is R2 configured".
export const storageEnabled = Boolean(env.R2_BUCKET);

const client = storageEnabled
  ? new S3Client({
      region: env.R2_REGION,
      endpoint:
        env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

/*
 * A presigned GET for one object. Returns `undefined` for a missing key or an
 * unconfigured bucket, so callers can render "not available yet" uniformly.
 *
 * Never throws: a failed signature must not turn a whole detail page into a 500
 * when the only casualty is one download link.
 */
export async function presignObject(
  objectKey: string | null | undefined,
): Promise<string | undefined> {
  if (!objectKey) return undefined;

  if (!client) {
    logger.debug({ objectKey }, 'Presign requested before R2 is configured');
    return undefined;
  }

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS },
    );
  } catch (error) {
    logger.error({ err: error, objectKey }, 'Failed to presign object');
    return undefined;
  }
}

// Presigns in parallel and drops the ones that failed, so a single bad key never
// blanks the whole set (a scan with one unreadable page still shows the rest).
export async function presignObjects(objectKeys: string[]): Promise<string[]> {
  const urls = await Promise.all(objectKeys.map((key) => presignObject(key)));
  return urls.filter((url): url is string => Boolean(url));
}

/*
 * A presigned PUT the browser uploads to directly.
 *
 * `contentType` and `contentLength` are part of the SIGNATURE, not a hint: the
 * upload is rejected unless the request carries exactly the values we signed.
 * That is what stops a caller from asking for a 2 MB image slot and pushing a
 * 2 GB file, or from storing an executable under a `.pdf` key.
 */
export type PresignedUpload = {
  objectKey: string;
  uploadUrl: string;
  // The headers the browser MUST send with the PUT for the signature to verify.
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export async function presignUpload(input: {
  objectKey: string;
  contentType: string;
  contentLength: number;
}): Promise<PresignedUpload | null> {
  if (!client) {
    logger.debug({ objectKey: input.objectKey }, 'Upload requested before R2 is configured');
    return null;
  }

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
    {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
      // Both must be signed headers, or a client could vary them after the fact.
      signableHeaders: new Set(['content-type', 'content-length']),
    },
  );

  return {
    objectKey: input.objectKey,
    uploadUrl,
    headers: {
      'Content-Type': input.contentType,
      'Content-Length': String(input.contentLength),
    },
    expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
  };
}

/*
 * Build the key an upload lands under: `<prefix>/<uuid>/<sanitised filename>`.
 *
 * The uuid segment is what makes the key unguessable and collision-free, so two
 * customers uploading `passport.pdf` never contend. The filename is kept only so
 * a downloaded object still has a sensible name — it is sanitised to a flat
 * segment first, because a raw `../` in a filename would otherwise let a caller
 * write outside its own prefix.
 */
export function buildObjectKey(prefix: string, fileName: string): string {
  return `${prefix}/${randomUUID()}/${safeFileName(fileName)}`;
}

const MAX_FILE_NAME_LENGTH = 120;

export function safeFileName(fileName: string): string {
  // Take the last path segment first: browsers on some platforms send a full
  // path, and only the basename is ever meaningful to us.
  const base = fileName.split(/[\\/]/).pop() ?? '';

  const cleaned = base
    .normalize('NFKD')
    // Anything outside this set becomes a hyphen — including the dots that would
    // otherwise let `..` survive as a traversal segment.
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+/, '')
    .slice(0, MAX_FILE_NAME_LENGTH);

  return cleaned || 'file';
}
