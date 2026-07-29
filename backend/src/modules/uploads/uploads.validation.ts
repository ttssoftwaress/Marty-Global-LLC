import { z } from 'zod';

/*
 * The upload wire contract (AGENTS.md: Zod schemas are the source of truth).
 *
 * A caller never names the object key or the bucket path — it declares WHAT it
 * is uploading and the server decides where that lands. `purpose` is therefore
 * the security boundary of this module: it selects the key prefix, the accepted
 * content types, the size ceiling, and who is allowed to ask at all.
 */

export const uploadPurpose = z.enum([
  // A customer's supporting document for an order — attached during the order
  // wizard (before the order row exists) or from the order's detail screen.
  'order-document',
  // A scanned envelope filed into a customer's mail room by an operator.
  'mail-scan',
  // A file the team delivers as part of a completed service's result record.
  'result-file',
  // A customer's own profile picture.
  'avatar',
  // A file attached to a support conversation message.
  'support-attachment',
]);
export type UploadPurpose = z.infer<typeof uploadPurpose>;

export const requestUploadSchema = z.object({
  purpose: uploadPurpose,
  /*
   * Used only to give the stored object a readable name — it is sanitised to a
   * single flat segment before it becomes part of the key, so it can never steer
   * where the object lands.
   */
  fileName: z.string().trim().min(1).max(255),
  // Signed into the presigned PUT, so the browser must send exactly this back.
  contentType: z.string().trim().min(1).max(120),
  /*
   * Declared up front so an oversized file is refused BEFORE a URL exists rather
   * than after the bytes have already been pushed. It is signed into the PUT as
   * Content-Length, which is what makes the declaration binding rather than a
   * promise the client can break.
   */
  sizeBytes: z.coerce.number().int().min(1),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;
