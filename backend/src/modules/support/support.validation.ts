import { z } from 'zod';

/*
 * The support wire contract (AGENTS.md: Zod schemas are the source of truth).
 *
 * The socket handlers validate against these same schemas, so a message posted
 * over Socket.io and one posted over REST are held to one contract. A payload
 * shape that only one transport accepted would be a guard that only one
 * transport enforced.
 */

// Cursor pagination, the API convention in AGENTS.md — the same `?cursor=&limit=`
// the admin inbox two modules over takes, so the customer's thread list is not a
// second, unbounded pagination mode.
export const listConversationsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

/*
 * A file already uploaded to R2 and now being attached to a message.
 *
 * The key is the only part that matters for security and it is never trusted on
 * its face: the service checks the prefix was minted for this purpose and this
 * caller before writing the row (uploads.service.ts). Name and size are display
 * metadata — the bytes are already stored, so these describe rather than decide.
 */
export const messageAttachmentSchema = z.object({
  objectKey: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(255),
  sizeBytes: z.coerce.number().int().min(1),
  contentType: z.string().trim().min(1).max(120).optional(),
});

// Four is what the composer allows, and the ceiling exists so one message cannot
// be used to attach an unbounded number of rows.
const attachments = z.array(messageAttachmentSchema).max(4).optional();

// A message the customer sends into a thread. The author is never taken from the
// client — it is resolved from the session, so a customer cannot post as an agent.
export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(5_000),
    attachments,
  })
  // An empty body is fine when files came with it (that is how "here are the
  // documents" is sent), but a message with neither is nothing at all.
  .refine((value) => value.body.length > 0 || (value.attachments?.length ?? 0) > 0, {
    path: ['body'],
    message: 'Write a message or attach a file',
  });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// What the customer picks when opening a thread. Lowercase on the wire, mapped to
// the Prisma enum in the service — the frontend never sees the database's casing.
export const conversationCategory = z.enum([
  'formation',
  'ecommerce',
  'mailroom',
  'billing',
  'documents',
  'support',
]);
export type ConversationCategoryInput = z.infer<typeof conversationCategory>;

/*
 * Opening a new support thread: a subject, a category, and the first message.
 *
 * Nothing about routing is accepted from the client — no assignee, no status, no
 * priority. Which agent answers it is decided server-side as the thread is
 * created, balanced across the team (support.assignment.ts), not by the customer.
 */
export const createConversationSchema = z.object({
  subject: z.string().trim().min(3).max(140),
  category: conversationCategory.default('support'),
  body: z.string().trim().min(1).max(5_000),
  attachments,
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
