import { z } from 'zod';

/*
 * The admin orders-queue wire contract. Mirrors
 * `frontend/src/admin/types/orders.ts`: the status tabs and the three dropdown
 * filters are query params the backend resolves, so a rendered page always
 * agrees with the tab counts beside it.
 */

// `all` is the unfiltered tab; every other value narrows to one order status.
export const orderStatusFilter = z.enum([
  'all',
  'draft',
  'submitted',
  'under_review',
  'missing_info',
  'approved',
  'paid',
  'processing',
  'completed',
]);
export type OrderStatusFilter = z.infer<typeof orderStatusFilter>;

/*
 * The date-range dropdown. Named windows rather than a free date pair: the
 * control is a single select, and the backend resolves each name to real bounds
 * so the client never builds a range from a zoneless string (AGENTS.md, Dates).
 */
export const orderDateRange = z.enum(['7d', '30d', '90d']);
export type OrderDateRange = z.infer<typeof orderDateRange>;

export const listOrdersQuerySchema = z.object({
  status: orderStatusFilter.default('all'),
  search: z.string().trim().max(120).optional(),
  // A service id from the catalog; absent means every service.
  service: z.string().trim().min(1).max(60).optional(),
  region: z.string().trim().min(1).max(8).optional(),
  dateRange: orderDateRange.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

/*
 * The queue's write side. Both are staff actions on an order the customer
 * cannot take themselves, so neither accepts anything the client could use to
 * decide an outcome — a status and an assignee id, nothing more.
 *
 * There is no free-text field here on purpose. Everything written to the order's
 * feed goes through `addActivitySchema` below, which forces an explicit
 * visibility; a note riding along on a status change would be a second way to
 * write to the feed with its audience implied rather than stated.
 */
export const updateOrderSchema = z
  .object({
    status: orderStatusFilter.exclude(['all']).optional(),
    // Null unassigns; a string assigns to that staff member.
    assigneeId: z.string().min(1).max(60).nullable().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.assigneeId !== undefined,
    { message: 'Nothing to update' },
  );
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

/*
 * A staff reply on the order.
 *
 * `visibility` is the whole contract: `customer` posts to the feed the customer
 * reads on their own order page and queues them an email; `internal` is a note
 * only the admin screen ever renders. It is required rather than defaulted —
 * defaulting either way turns a forgotten field into either a leaked internal
 * note or a reply the customer never receives, and neither is recoverable.
 */
export const activityVisibility = z.enum(['customer', 'internal']);
export type ActivityVisibility = z.infer<typeof activityVisibility>;

export const addActivitySchema = z.object({
  message: z.string().trim().min(1).max(5_000),
  visibility: activityVisibility,
});
export type AddActivityInput = z.infer<typeof addActivitySchema>;

/*
 * Asking the customer to upload a document.
 *
 * `name` is what the customer is told to send ("a certified passport copy"), so
 * it is the only field: the request is a placeholder row on the order's
 * Documents card, not a message. A reviewer who needs to explain *why* posts an
 * activity reply beside it, which already has its own visibility contract above.
 */
export const requestDocumentSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type RequestDocumentInput = z.infer<typeof requestDocumentSchema>;

/*
 * Opening one of the order's documents.
 *
 * `disposition` is the difference between the two controls on the card: `inline`
 * previews the file in a new tab, `attachment` saves it. It is signed into the
 * presigned URL, so the choice has to be made when the link is minted rather
 * than by the browser afterwards — which is why it is a request parameter at all
 * and not a frontend concern.
 */
export const documentLinkQuerySchema = z.object({
  disposition: z.enum(['inline', 'attachment']).default('inline'),
});
export type DocumentLinkQuery = z.infer<typeof documentLinkQuerySchema>;
