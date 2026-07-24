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

export const createOrderSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1).max(20),
  answersByService: z.record(z.string(), z.record(z.string(), answerValue)).default({}),
  notes: z.string().trim().max(5_000).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
