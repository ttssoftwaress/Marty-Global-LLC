/*
 * Order conversation, staff side — local mirror of
 * `GET /v1/orders/:orderId/conversation` as the admin order screen reads it.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule).
 *
 * The same endpoint the customer's portal calls, returning a different view of
 * the same thread: staff see internal notes, the customer never does. That
 * asymmetry is resolved server-side — the notes are filtered out of the
 * customer's query rather than hidden by their screen — so this type carrying an
 * `internal_note` kind is safe.
 *
 * Distinct from `support.ts`: a support thread is routed to whichever agent is
 * free, while an order conversation is answerable only by that order's assignee.
 */

export type OrderConversationMessageKind = 'customer' | 'staff' | 'internal_note';

export type OrderConversationMessage = {
  id: string;
  kind: OrderConversationMessageKind;
  // Resolved per-viewer by the backend, so an admin stepping in sees the
  // assignee's replies as someone else's rather than their own.
  mine: boolean;
  authorName: string;
  authorInitials: string;
  body: string;
  sentAt: string; // ISO-8601 UTC
};

export type OrderConversationAssignee = {
  id: string;
  name: string;
  initials: string;
};

export type OrderConversationStatus = 'open' | 'pending' | 'resolved';

export type AdminOrderConversation = {
  id: string;
  orderId: string;
  orderReference: string;
  status: OrderConversationStatus;
  assignee: OrderConversationAssignee | null;
  canReply: boolean;
  lockedReason: string | null;
  messages: OrderConversationMessage[];
};

// The composer's two modes. A reply reaches the customer; a note never does —
// which is why the kind travels on the wire rather than being inferred.
export type OrderConversationReplyKind = 'reply' | 'note';
