/*
 * Messages — local mirror of the API shapes the Messages screen renders. The
 * backend is the source of truth (AGENTS.md, two-apps sync rule); these types
 * exist so the UI compiles and composes before the endpoints land.
 *
 * The Messages surface is the customer's view of the live-chat / support module
 * (AGENTS.md, Live Chat): each conversation is a persisted thread with the team.
 * Real-time delivery arrives over `services/socket.ts` once the support module
 * lands; until then the thread loads over REST like every other screen.
 *
 * Dates stay ISO-8601 UTC and are formatted only at render (AGENTS.md, Dates).
 */

import type { OrderStatus } from './dashboard';

// The subject a conversation is about — drives the list's icon chip. `support`
// is a general thread with no linked record; the rest mirror the portal's
// domains so the glyph matches what the conversation is about.
export type ConversationCategory =
  | 'formation'
  | 'ecommerce'
  | 'mailroom'
  | 'billing'
  | 'documents'
  | 'support';

// Who wrote a message. `customer` is the signed-in user — right-aligned bubbles,
// no avatar. `agent` is a Marty Global team member — left-aligned, shown with
// their name and avatar at the start of each run.
export type MessageAuthor = 'customer' | 'agent';

// A file attached to a message. `href` is the short-TTL presigned URL the
// backend hands out after an ownership check (AGENTS.md, Security & PII); absent
// until the upload is ready.
export type MessageAttachment = {
  id: string;
  name: string; // "articles-of-organization.pdf"
  size: number; // bytes — formatted at render
  href?: string;
};

export type Message = {
  id: string;
  author: MessageAuthor;
  body: string;
  sentAt: string; // ISO-8601 UTC
  // Agent messages only — the team member who wrote it. A fallback avatar
  // renders from the name when `senderAvatarUrl` is absent.
  senderName?: string; // "Sarah — Client Success"
  senderAvatarUrl?: string;
  attachments?: MessageAttachment[];
  /*
   * Whether the team has read this message. Set on the customer's own messages
   * only — a "Seen" tick under an agent's reply would be reporting the
   * customer's own reading back to them. Derived server-side from the thread's
   * staff read marker.
   */
  seen?: boolean;
  /*
   * Local-only, never from the API: a message this browser has drawn but the
   * server has not confirmed yet. It carries the id the send was tagged with, so
   * the delivered copy replaces the optimistic bubble instead of appearing
   * beside it.
   */
  pending?: boolean;
  clientId?: string;
};

/*
 * A row in the conversation list. `status` mirrors the linked subject's status
 * (its order/registration) and drives the chip; it is absent for a general
 * support thread, which shows no chip. `unread` shows the dot; `preview` and
 * `lastMessageAt` fill the meta row.
 */
export type ConversationSummary = {
  id: string;
  subject: string; // "LLC Formation — USA"
  category: ConversationCategory;
  status?: OrderStatus; // linked subject's status; absent → no chip
  orderId?: string; // when set, the thread header links to the order
  preview: string; // last message snippet
  lastMessageAt: string; // ISO-8601 UTC — "2h ago"
  unread: boolean;
};

// A single conversation with its full message history. The list summary fills
// the thread header while this resolves.
export type ConversationThread = {
  id: string;
  subject: string;
  category: ConversationCategory;
  status?: OrderStatus;
  orderId?: string;
  messages: Message[];
};
