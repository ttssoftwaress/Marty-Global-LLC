/*
 * Order conversation — local mirror of `GET /v1/orders/:orderId/conversation`.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule).
 *
 * Distinct from `messages.ts` next door, and the distinction is the point:
 *
 *   - a SUPPORT thread (messages.ts) is opened cold and routed to whichever
 *     agent is free — that is the Messages screen and the help widget
 *   - an ORDER conversation (this file) is bound to one order and answerable
 *     only by that order's assigned specialist
 *
 * The screen decides none of that. Whether the customer may reply, and the
 * sentence explaining why not, both arrive with the record — the rule lives in
 * the backend, and a second copy of it here would be the one the customer sees
 * when the two disagree.
 */

export type ConversationMessageKind = 'customer' | 'staff' | 'internal_note';

export type ConversationMessage = {
  id: string;
  kind: ConversationMessageKind;
  // Resolved per-viewer by the backend: the same row is an own-bubble on one
  // screen and the counterparty's on the other.
  mine: boolean;
  authorName: string;
  authorInitials: string;
  body: string;
  sentAt: string; // ISO-8601 UTC
};

// Who the customer is talking to. Null while the order is unassigned, which is
// what puts the composer in its read-only state.
export type ConversationAssignee = {
  id: string;
  name: string;
  initials: string;
};

export type OrderConversationStatus = 'open' | 'pending' | 'resolved';

export type OrderConversation = {
  id: string;
  orderId: string;
  orderReference: string;
  status: OrderConversationStatus;
  assignee: ConversationAssignee | null;
  // The server's answer, not a client-side derivation — the composer's disabled
  // state and the endpoint's refusal have to agree, and the endpoint is the real
  // boundary (AGENTS.md, Auth).
  canReply: boolean;
  lockedReason: string | null;
  messages: ConversationMessage[];
};
