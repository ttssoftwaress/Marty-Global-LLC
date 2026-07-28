import { z } from 'zod';

/*
 * The anonymous visitor chat's wire contract.
 *
 * This is the only unauthenticated write surface on the backend, so its schemas
 * are the tightest: short fields, no client-supplied identity, no routing hints,
 * and nothing that names a conversation. Which thread a guest is talking in is
 * derived from their token, never sent — otherwise holding any conversation id
 * would be enough to post into a stranger's chat.
 */

export const startGuestChatSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // The only way we can reach them once they close the tab, which is what makes
  // the offline handoff work for a visitor with no account.
  email: z.email().max(200),
  body: z.string().trim().min(1).max(2_000),
  /*
   * Cloudflare Turnstile's client token, verified server-side before anything is
   * written. Optional in the schema, not in effect: config/turnstile.ts refuses a
   * missing token whenever a secret is configured, and this way a deployment
   * without Turnstile set up doesn't 400 every visitor.
   */
  turnstileToken: z.string().trim().max(2_048).optional(),
});
export type StartGuestChatInput = z.infer<typeof startGuestChatSchema>;

// Guests get no attachments: an unauthenticated upload slot is a very different
// risk from a signed-in one, and a pre-sales chat does not need it.
export const guestMessageSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
});
export type GuestMessageInput = z.infer<typeof guestMessageSchema>;
