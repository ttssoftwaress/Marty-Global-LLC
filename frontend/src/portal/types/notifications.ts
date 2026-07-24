/*
 * Notifications — local mirror of the API shapes the top-bar notification panel
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * these types exist so the UI compiles and composes before the `notifications`
 * module's endpoints land.
 *
 * A notification is one entry in the customer's feed — an order changing status,
 * a quote to pay, a document request, a reply on a thread. The category drives
 * the row's icon and tint; `href` is the in-app destination for the actionable
 * ones (the design's chevron rows). Dates stay ISO-8601 UTC and are formatted
 * only at render (AGENTS.md, Dates).
 */

// What a notification is about — drives its icon glyph and tint. Mirrors the
// portal's domains so the icon matches the subject:
//   - `order`   — a formation/registration application changed state
//   - `billing` — a quote is ready or a payment needs action
//   - `document`— an action is required on a document (missing/rejected)
//   - `message` — a reply or new message on a support thread
//   - `payment` — a payment was received/confirmed
//   - `mailroom`— a mail room or scanned item update
export type NotificationCategory =
  | 'order'
  | 'billing'
  | 'document'
  | 'message'
  | 'payment'
  | 'mailroom';

export type Notification = {
  id: string;
  category: NotificationCategory;
  // The single-line body the row shows — resolved server-side so wording and
  // any amounts (integer minor units → formatted there) arrive display-ready.
  message: string;
  createdAt: string; // ISO-8601 UTC — rendered as "2h ago"
  read: boolean;
  // When set, the row is a link into the app (the design's chevron rows) — e.g.
  // an order detail, a quote, a message thread. Absent → the row is informational.
  href?: string;
  // Date bucket for the full-page feed's group dividers, stamped server-side so
  // grouping stays stable across paginated loads (see `NotificationGroup`). The
  // top-bar panel doesn't group, so it's optional; the feed falls back to
  // deriving it from `createdAt` when absent.
  group?: NotificationGroup;
};

/*
 * The full-page feed (`/app/notifications`) adds three things the top-bar panel
 * doesn't: a category filter across the top, date grouping down the list, and
 * cursor pagination for "Load older notifications".
 *
 * `NotificationFilter` is the set of filter tabs the design shows. `all` and
 * `unread` are cross-cutting; the rest narrow to a subject. The narrowing tabs
 * don't map one-to-one onto `NotificationCategory` — "Status updates" covers the
 * order/mailroom/payment lifecycle events — so the tab→category mapping lives in
 * the feature layer, not here. The backend still resolves the actual filtering;
 * this type is the wire value the query sends.
 */
export type NotificationFilter =
  | 'all'
  | 'unread'
  | 'status'
  | 'quotes'
  | 'documents'
  | 'messages';

/*
 * Which date bucket a notification falls in — the list's group dividers. The
 * backend stamps each row's bucket (rather than the client deriving it) so the
 * grouping stays stable across the page's paginated loads and matches the
 * server's clock, not the browser's.
 */
export type NotificationGroup = 'today' | 'this_week' | 'earlier';

// One page of the feed, mirroring the cursor-pagination envelope (AGENTS.md,
// API Conventions). `unreadCount` backs the "Unread" tab's count pill and is the
// total across the feed, not just this page.
export type NotificationFeedPage = {
  notifications: Notification[];
  unreadCount: number;
  // Cursor for the next (older) page; null when the feed is exhausted.
  nextCursor: string | null;
};
