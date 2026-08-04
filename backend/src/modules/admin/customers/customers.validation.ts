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

/*
 * Suspending an account. The reason is optional and short: it is staff-written
 * text stored on the user row and shown back on the record, so the next person to
 * open it knows why the account is closed rather than guessing. It is never shown
 * to the customer — the sign-in refusal says nothing about it.
 */
export const banCustomerSchema = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
});
export type BanCustomerInput = z.infer<typeof banCustomerSchema>;
