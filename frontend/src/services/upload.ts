import { apiFetch, ApiError } from './api';
import { contentTypeOf } from '@/constants/uploads';
import type { ApiSuccess } from '@/types/api';

/*
 * Uploading a file.
 *
 * Two steps, and the bytes never touch our API: we ask the backend for a
 * presigned PUT, then send the file straight to R2 with it. Only the resulting
 * object key travels back through the app, on whatever request attaches the file
 * to something (an order, a mail item, a result field).
 *
 * The backend decides everything that matters — where the object lands, what
 * types are accepted, how large it may be, and whether this account may upload
 * that kind of file at all. `purpose` is the whole of what we ask for, so a
 * caller here can neither choose a path nor raise its own limit.
 */

export type UploadPurpose =
  | 'order-document'
  | 'mail-scan'
  | 'result-file'
  | 'avatar'
  | 'support-attachment';

type PresignedUpload = {
  objectKey: string;
  uploadUrl: string;
  // The headers the PUT must carry for the signature to verify. Sent verbatim —
  // changing or omitting one makes R2 reject the upload.
  headers: Record<string, string>;
  expiresInSeconds: number;
};

/*
 * What an attached file is once it is in R2 — the shape every "attach" endpoint
 * takes. Deliberately carries no URL: a link is minted per request at read time,
 * after an ownership check (AGENTS.md, Security & PII).
 */
export type UploadedFile = {
  objectKey: string;
  name: string;
  contentType: string;
  sizeBytes: number;
};

// R2 signs against a concrete content type, and `File.type` is not always one —
// `constants/uploads.ts` explains what it does about that.

/*
 * Upload one file and resolve to what the attach request needs.
 *
 * `onProgress` reports 0–1. It uses XMLHttpRequest rather than fetch because a
 * request body's progress is not observable through fetch in browsers today, and
 * a document upload with no feedback reads as a frozen screen.
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  options?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<UploadedFile> {
  const contentType = contentTypeOf(file);

  const presigned = await apiFetch<ApiSuccess<PresignedUpload>>('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      purpose,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  }).then((response) => response.data);

  await putToStorage(presigned, file, options);

  return {
    objectKey: presigned.objectKey,
    name: file.name,
    contentType,
    sizeBytes: file.size,
  };
}

function putToStorage(
  presigned: PresignedUpload,
  file: File,
  options?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', presigned.uploadUrl);

    for (const [header, value] of Object.entries(presigned.headers)) {
      /*
       * Content-Length is set by the browser from the body and is forbidden to
       * set by hand — assigning it throws in some browsers and is silently
       * dropped in others. It is still part of the signature; the browser sends
       * the same value because it is sending exactly this file.
       */
      if (header.toLowerCase() === 'content-length') continue;
      request.setRequestHeader(header, value);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options?.onProgress?.(event.loaded / event.total);
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        options?.onProgress?.(1);
        resolve();
        return;
      }

      // The storage provider's own error body is not ours to surface — it can
      // carry bucket names and request ids. The status is enough to act on.
      reject(
        new ApiError(
          request.status,
          'INTERNAL_ERROR',
          `Could not upload ${file.name}. Please try again.`,
        ),
      );
    };

    request.onerror = () =>
      reject(
        new ApiError(
          0,
          'INTERNAL_ERROR',
          `Could not upload ${file.name}. Check your connection and try again.`,
        ),
      );

    request.onabort = () =>
      reject(new ApiError(0, 'INTERNAL_ERROR', 'Upload cancelled'));

    options?.signal?.addEventListener('abort', () => request.abort(), {
      once: true,
    });

    request.send(file);
  });
}

/*
 * Upload several files, reporting one combined 0–1 across the whole set.
 *
 * Sequential rather than parallel: a customer attaching five scans on a phone
 * connection gets a progress bar that moves steadily and an upload that is not
 * competing with itself for bandwidth. The first failure rejects — a partial
 * attach is not something any caller here wants to reason about.
 */
export async function uploadFiles(
  files: File[],
  purpose: UploadPurpose,
  options?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];

  for (const [index, file] of files.entries()) {
    const result = await uploadFile(file, purpose, {
      signal: options?.signal,
      onProgress: (fraction) =>
        options?.onProgress?.((index + fraction) / files.length),
    });

    uploaded.push(result);
  }

  return uploaded;
}
