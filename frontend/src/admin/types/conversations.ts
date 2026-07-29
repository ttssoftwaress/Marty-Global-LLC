/*
 * "My conversations" — local mirror of `GET /v1/admin/conversations`. The backend
 * is the source of truth (AGENTS.md, two-apps sync rule).
 *
 * These are order conversations, not support threads. The list exists because of
 * the assignee lock: only an order's assignee can see its thread, so there is no
 * shared queue that would ever show it to them. Support work is found in the
 * inbox; this work has to be handed to the person who owns it.
 */

export type StaffConversationStatus = 'open' | 'pending' | 'resolved';

export type StaffConversationRow = {
  id: string;
  orderId: string;
  orderReference: string;
  customerName: string;
  customerInitials: string;
  preview: string;
  lastMessageAt: string; // ISO-8601 UTC
  // The newest message came from the customer — this thread is waiting on us.
  awaitingReply: boolean;
  status: StaffConversationStatus;
  // Where the thread is read: the order it belongs to, not a page of its own.
  to: string;
};

export type StaffConversationsView = {
  conversations: StaffConversationRow[];
  // Counted over the whole queue, not the loaded page, so the header pill stays
  // truthful as the list pages in.
  awaitingCount: number;
  // Cursor pagination, like every other admin list (AGENTS.md, API Conventions).
  nextCursor: string | null;
};
