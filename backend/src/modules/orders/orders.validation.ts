import { z } from 'zod';

// The orders wire contract (AGENTS.md: Zod schemas are the source of truth).

// The list query. `filter` maps to a server-side status set; `search` matches a
// reference or service name. Cursor pagination per AGENTS.md, plus a 1-based
// `page` the UI's "Page X of Y" control reads back.
export const orderFilter = z.enum(['all', 'active', 'completed', 'attention']);
export type OrderFilter = z.infer<typeof orderFilter>;

export const listOrdersQuerySchema = z.object({
  filter: orderFilter.default('all'),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().min(1).optional(),
  // The list renders 10 per page in the design; cap so a client can't ask for
  // an unbounded page.
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// Create an order. The customer picks one or more services (Step 1) and fills in
// each service's fields (Step 2). Answers are keyed by service id, then field
// name — the same shape the frontend's OrderApplicationDraft collects. Values are
// strings (every field type renders to a string on the wire); the service
// validates required/known fields against each service's own detailFields schema,
// since the catalog — not this schema — knows what each service asks.
const answerValue = z.string().max(5_000);

/*
 * A file the customer attached — to a `file` question on a service's form, or to
 * the application as a supporting document.
 *
 * The bytes went straight to R2 through `POST /v1/uploads` (AGENTS.md, Storage);
 * this carries only the key they landed under. Each becomes an `OrderDocument`
 * row on the created order, which is what makes an attachment survive as
 * something the team can open rather than a filename in an answer string.
 */
export const orderDocumentInputSchema = z.object({
  objectKey: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().min(1).optional(),
});
export type OrderDocumentInput = z.infer<typeof orderDocumentInputSchema>;

export const createOrderSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1).max(20),
  answersByService: z.record(z.string(), z.record(z.string(), answerValue)).default({}),
  notes: z.string().trim().max(5_000).optional(),
  /*
   * Flat across the whole application rather than keyed by service: the design
   * collects supporting documents once for the order, and a per-question file is
   * still a document belonging to the same application.
   *
   * Optional rather than defaulted, so the service stays callable with an order
   * that simply has no attachments — which is most of them.
   */
  documents: z.array(orderDocumentInputSchema).max(30).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Attaching a document to an order that already exists — the order-detail
// screen's dropzone.
export const uploadOrderDocumentsSchema = z.object({
  documents: z.array(orderDocumentInputSchema).min(1).max(20),
});
export type UploadOrderDocumentsInput = z.infer<typeof uploadOrderDocumentsSchema>;
