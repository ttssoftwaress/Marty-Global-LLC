import { randomUUID } from 'node:crypto';

import {
  GetObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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
      /*
       * Both must stay WHEN_REQUIRED, and this is load-bearing for uploads.
       *
       * The SDK defaults to WHEN_SUPPORTED, which makes it attach a CRC32 of the
       * request body to every PutObject. While PRESIGNING there is no body yet,
       * so it hashes an empty one and hoists the result into the URL's query
       * string as `x-amz-checksum-crc32=AAAAAA==` — inside the signature, so the
       * browser cannot drop it. R2 then checks that empty-body checksum against
       * the real file and rejects every upload with a 400.
       *
       * The signed content-type and content-length below are what actually bind
       * an upload to what we authorised; the SDK's body checksum adds nothing we
       * rely on and breaks the one thing we need.
       */
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  : null;

/*
 * How the browser should treat the object behind a presigned GET.
 *
 * `attachment` is what separates a "Download" control from a "View" one: the
 * disposition is signed into the URL and comes back as a response header, so the
 * file saves under `fileName` instead of rendering in the tab. Without it a PDF
 * always previews and a download link is a lie. Omit the option entirely and the
 * object is served exactly as it was stored, which is what every inline consumer
 * (avatars, scan pages, invoice links) already relies on.
 */
export type PresignOptions = {
  disposition: 'inline' | 'attachment';
  // The name the file saves under. Sanitised before signing — see below.
  fileName?: string;
};

function contentDisposition({ disposition, fileName }: PresignOptions): string {
  if (!fileName) return disposition;

  // Run through the same sanitiser as an upload key: this value is signed into a
  // URL and echoed back as a header, so a quote or newline in a customer's own
  // filename would be a header injection rather than a cosmetic problem.
  return `${disposition}; filename="${safeFileName(fileName)}"`;
}

/*
 * A presigned GET for one object. Returns `undefined` for a missing key or an
 * unconfigured bucket, so callers can render "not available yet" uniformly.
 *
 * Never throws: a failed signature must not turn a whole detail page into a 500
 * when the only casualty is one download link.
 */
export async function presignObject(
  objectKey: string | null | undefined,
  options?: PresignOptions,
): Promise<string | undefined> {
  if (!objectKey) return undefined;

  if (!client) {
    logger.debug({ objectKey }, 'Presign requested before R2 is configured');
    return undefined;
  }

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: objectKey,
        ...(options
          ? { ResponseContentDisposition: contentDisposition(options) }
          : {}),
      }),
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

/*
 * The bucket's CORS policy — applied out of band by `npm run storage:cors`.
 *
 * This is not decoration. Uploads are browser-to-R2 by design, and a
 * cross-origin PUT carrying a Content-Type is always preflighted. A bucket with
 * no CORS rule answers that preflight with `403 CORS not configured for this
 * bucket`, so the PUT never leaves the browser: no API log, no R2 log, just a
 * network error on a screen where everything else is configured correctly.
 *
 * Origins are exact, never wildcards (AGENTS.md, CORS). GET is included because
 * a presigned download link is fetched by the page for some viewers rather than
 * being followed as a plain href.
 */
export function bucketCorsRules(origins: string[]) {
  return [
    {
      AllowedOrigins: origins,
      AllowedMethods: ['PUT', 'GET'],
      // The only header the browser sends that needs clearing: Content-Length is
      // set by the browser itself and is not preflightable.
      AllowedHeaders: ['content-type'],
      ExposeHeaders: ['etag'],
      // Preflight once per hour rather than once per file — a 50-page scan batch
      // would otherwise double its request count for no benefit.
      MaxAgeSeconds: 3600,
    },
  ];
}

export async function applyBucketCors(origins: string[]): Promise<void> {
  if (!client) {
    throw new Error('R2 is not configured — nothing to apply a CORS policy to');
  }

  await client.send(
    new PutBucketCorsCommand({
      Bucket: env.R2_BUCKET,
      CORSConfiguration: { CORSRules: bucketCorsRules(origins) },
    }),
  );
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
