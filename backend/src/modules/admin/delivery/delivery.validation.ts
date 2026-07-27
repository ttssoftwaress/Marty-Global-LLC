import { z } from 'zod';

import { resultValueInputSchema } from '../../results/results.validation.js';

/*
 * Service delivery's admin wire contract — filling in a result and working the
 * follow-up queue (AGENTS.md: Zod schemas are the source of truth). Mirrors
 * `frontend/src/admin/types/delivery.ts`.
 *
 * A value's TYPE is not validated here. It cannot be: the schema is resolved at
 * runtime from whichever fields the service returns, so the rules for a `date`
 * versus a `number` live in `results.values.ts`, which knows the field. This
 * file validates the envelope; the service layer validates the contents.
 */

/*
 * Save a result. `deliver` is the difference between a draft and a delivery, and
 * therefore between "nobody sees this" and "the customer's page is live":
 *
 *   false — save progress. Required fields may be blank; the record stays DRAFT.
 *   true  — deliver. Every required field must be filled, the record becomes
 *           ACTIVE, and the order item is marked COMPLETED.
 *
 * One endpoint rather than two because it is one form with two buttons, and the
 * staff member is editing the same values either way.
 */
export const saveResultSchema = z.object({
  values: z.array(resultValueInputSchema).max(200),
  deliver: z.boolean().optional(),
});
export type SaveResultInput = z.infer<typeof saveResultSchema>;

export const updateResultStatusSchema = z.object({
  status: z.enum(['active', 'archived']),
});
export type UpdateResultStatusInput = z.infer<typeof updateResultStatusSchema>;

// --- The requests queue ---------------------------------------------------

export const requestStatusSchema = z.enum([
  'submitted',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
]);

export const listAdminRequestsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: requestStatusSchema.optional(),
  serviceId: z.string().min(1).optional(),
  // "Assigned to me" / "Unassigned" — the queue's two standing filters.
  assignee: z.enum(['me', 'unassigned']).optional(),
  search: z.string().trim().max(120).optional(),
});
export type ListAdminRequestsQuery = z.infer<typeof listAdminRequestsQuerySchema>;

/*
 * Moving a request through its workflow.
 *
 * `blockedReason` pairs with BLOCKED and `resolution` with COMPLETED — the
 * service enforces the pairing rather than the schema, because "required when
 * status is X" across a partial update is a rule that reads far more clearly as
 * a business check than as a chain of Zod refinements. Both are cleared when the
 * request moves off their state, so a stale reason can never outlive it.
 */
export const updateRequestSchema = z
  .object({
    status: requestStatusSchema.optional(),
    // Explicit null unassigns; absent leaves the assignee alone. The two must be
    // distinguishable, which is why this is nullable-optional rather than just
    // optional.
    assigneeId: z.string().min(1).nullable().optional(),
    blockedReason: z.string().trim().max(1000).optional(),
    resolution: z.string().trim().max(2000).optional(),
    // A note added alongside the change. `internal` keeps it staff-only, exactly
    // as an order's activity feed does.
    note: z.string().trim().max(2000).optional(),
    internal: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']),
});
export type UpdateOrderItemStatusInput = z.infer<
  typeof updateOrderItemStatusSchema
>;
