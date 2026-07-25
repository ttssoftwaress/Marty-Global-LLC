import { z } from 'zod';

// The support wire contract (AGENTS.md: Zod schemas are the source of truth).
// The same schemas the socket handler will validate against when live chat lands
// — one contract for both transports.

export const listConversationsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

// A message the customer sends into a thread. The author is never taken from the
// client — it is resolved from the session, so a customer cannot post as an agent.
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
