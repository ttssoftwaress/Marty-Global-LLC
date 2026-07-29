import { z } from 'zod';

/*
 * The wire contract for "My conversations" (AGENTS.md: Zod schemas are the source
 * of truth).
 *
 * Nothing here identifies whose list to load — that is the session's job, and
 * accepting it would be the way a staff member read a colleague's threads. The
 * only input is where in the stream to read from, which is the cursor pagination
 * every other list in the admin area takes.
 */

export const listMyConversationsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListMyConversationsQuery = z.infer<typeof listMyConversationsQuerySchema>;
