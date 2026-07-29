/*
 * The staff member's own notification feed — the admin top-bar panel and
 * `/admin/notifications`. Local mirror of the backend's
 * `modules/admin/notifications` contract (AGENTS.md: the backend is the source
 * of truth, the frontend keeps its own copy, both change in the same task).
 *
 * The category set matches the customer feed's because both read the same
 * ledger; the *filters* differ — a staff member's tabs are the work queues they
 * own, not the paperwork tabs a customer gets.
 */

export type AdminNotificationCategory =
  | 'order'
  | 'billing'
  | 'document'
  | 'message'
  | 'payment'
  | 'mailroom';

export type AdminNotification = {
  id: string;
  category: AdminNotificationCategory;
  /** Display-ready — resolved server-side, amounts already formatted. */
  message: string;
  /** ISO-8601 UTC; rendered relative ("2h ago") at display time only. */
  createdAt: string;
  read: boolean;
  /** Set → the row links into `/admin/*`; absent → informational. */
  href?: string;
  /** Server-stamped bucket; the feed derives it if absent. */
  group?: AdminNotificationGroup;
};

export type AdminNotificationFilter =
  | 'all'
  | 'unread'
  | 'orders'
  | 'payments'
  | 'support'
  | 'mailroom';

export type AdminNotificationGroup = 'today' | 'this_week' | 'earlier';

export type AdminNotificationFeedPage = {
  notifications: AdminNotification[];
  /** Total unread across the feed, not just this page — backs the tab pill and the bell badge. */
  unreadCount: number;
  /** null when the feed is exhausted. */
  nextCursor: string | null;
};
