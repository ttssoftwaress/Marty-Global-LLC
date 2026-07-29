import { z } from 'zod';

/*
 * The order-conversation wire contract (AGENTS.md: Zod schemas are the source of
 * truth). Mirrored by `frontend/src/portal/types/conversation.ts` and
 * `frontend/src/admin/types/order-conversation.ts`.
 *
 * Deliberately smaller than the support contract next door. A support thread
 * carries a subject, a category, and a routing decision because the customer is
 * opening it cold; an order conversation has all three implied by the order it
 * hangs off, so the only thing the client ever sends is a message body.
 */

// The author is never on the wire — it is resolved from the session, so a
// customer cannot post as the assigned staff member and vice versa.
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/*
 * The staff composer. `kind` is a real mode switch rather than styling: a reply
 * reaches the customer, a note never does, so the distinction travels on the wire
 * instead of being inferred from who is signed in (the same shape the support
 * inbox uses, for one composer contract across both surfaces).
 */
export const staffSendMessageSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
  kind: z.enum(['reply', 'note']).default('reply'),
});
export type StaffSendMessageInput = z.infer<typeof staffSendMessageSchema>;
