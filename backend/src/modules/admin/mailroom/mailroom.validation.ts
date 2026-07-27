import { z } from 'zod';

/*
 * The admin virtual mail-ops wire contract. Mirrors
 * `frontend/src/admin/types/mailroom.ts`.
 */

export const customerSearchQuerySchema = z.object({
  // The picker never fetches unfiltered: the frontend gates the call on two
  // characters and the schema requires them, so "every customer" is not a query
  // this endpoint can be asked for.
  search: z.string().trim().min(2).max(120),
});
export type CustomerSearchQuery = z.infer<typeof customerSearchQuerySchema>;

export const listScansQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListScansQuery = z.infer<typeof listScansQuerySchema>;

/*
 * One uploaded file of a scan. The bytes go straight to R2 through
 * `POST /v1/uploads` (AGENTS.md, Storage); this carries the object key they
 * landed under, so nothing round-trips through the API process.
 *
 * `contentType` is kept because the customer's viewer needs it to choose a
 * renderer — an image page is drawn inline, a PDF is handed to the browser
 * whole — and it must not be re-sniffed from the object at read time.
 */
export const scanFileSchema = z.object({
  objectKey: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().min(1).optional(),
});
export type ScanFileInput = z.infer<typeof scanFileSchema>;

/*
 * Filing a scan into a customer's inbox.
 *
 * An envelope is rarely one file: an operator scans several sheets, or attaches
 * a single multi-page PDF. `files` is therefore ordered — position is what
 * becomes the page number — and at least one is required.
 */
export const uploadScanSchema = z.object({
  customerId: z.string().min(1).max(60),
  sender: z.string().trim().min(1).max(160),
  // A plain calendar date — the day the physical mail arrived. It has no
  // time-of-day, so it must not be built from a zoneless timestamp
  // (AGENTS.md, Dates); the service anchors it at midnight UTC.
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd'),
  files: z.array(scanFileSchema).min(1).max(50),
  notes: z.string().trim().max(500).optional(),
});
export type UploadScanInput = z.infer<typeof uploadScanSchema>;

// The pending queue's filter strip. `all` and `completed` are not request types
// — they widen or narrow the queue — so they sit alongside the two that are.
export const mailRequestFilter = z.enum([
  'all',
  'forwarding',
  'shredding',
  'completed',
]);
export type MailRequestFilter = z.infer<typeof mailRequestFilter>;

export const listRequestsQuerySchema = z.object({
  filter: mailRequestFilter.default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

/*
 * Settling a request from the slide-over. One shape for both types: the backend
 * decides what settling means for a forwarding versus a shredding request, so
 * the client only reports what the operator entered (AGENTS.md — business logic
 * lives in services).
 */
export const resolveRequestSchema = z.object({
  trackingNumber: z.string().trim().max(80).optional(),
  carrier: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type ResolveRequestInput = z.infer<typeof resolveRequestSchema>;

export const mailLogAction = z.enum(['all', 'forwarded', 'shredded', 'downloaded']);
export const mailLogRange = z.enum(['all', '7d', '30d', '90d']);

export const listLogQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  range: mailLogRange.default('all'),
  action: mailLogAction.default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(8),
});
export type ListLogQuery = z.infer<typeof listLogQuerySchema>;
