import { z } from 'zod';

/*
 * The admin support-inbox wire contract. Mirrors
 * `frontend/src/admin/types/support.ts`.
 */

export const supportFilter = z.enum(['all', 'unassigned', 'assigned', 'resolved']);
export type SupportFilter = z.infer<typeof supportFilter>;

export const listConversationsQuerySchema = z.object({
  filter: supportFilter.default('all'),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

/*
 * The composer. The two tabs are a real mode switch, not styling: a `reply`
 * reaches the customer, a `note` never does — which is why the kind is on the
 * wire rather than inferred from who is signed in.
 */
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  kind: z.enum(['reply', 'note']).default('reply'),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const updateConversationSchema = z
  .object({
    status: z.enum(['open', 'pending', 'resolved']).optional(),
    // Null unassigns; a string assigns to that staff member.
    assigneeId: z.string().min(1).max(60).nullable().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.assigneeId !== undefined,
    { message: 'Nothing to update' },
  );
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
