import { z } from 'zod';

/*
 * The admin customers wire contract. Mirrors
 * `frontend/src/admin/types/customers.ts`: the segment tabs and the region
 * dropdown are query params the backend resolves, so the UI never filters,
 * sorts, or counts rows client-side.
 */

// The cohort tabs above the list. `all` is the unfiltered view.
export const customerSegment = z.enum([
  'all',
  'active',
  'has-open-orders',
  'no-orders',
]);
export type CustomerSegment = z.infer<typeof customerSegment>;

export const listCustomersQuerySchema = z.object({
  segment: customerSegment.default('all'),
  // A region code from GET /admin/catalog/regions, or absent for every region.
  region: z.string().trim().min(1).max(8).optional(),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

export const listCustomerOrdersQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListCustomerOrdersQuery = z.infer<typeof listCustomerOrdersQuerySchema>;
