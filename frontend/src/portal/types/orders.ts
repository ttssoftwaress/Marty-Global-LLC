/*
 * My orders — local mirror of the API shapes the orders list renders. The
 * backend is the source of truth (AGENTS.md, two-apps sync rule); these types
 * exist so the UI compiles and composes before the endpoints land.
 *
 * `OrderStatus` and the base order fields are re-exported from the dashboard
 * mirror so a status reads and renders identically on both screens — one
 * definition, no drift.
 */

import type { DashboardOrder, Money, OrderStatus } from './dashboard';

export type { OrderStatus };

// The orders list carries the same fields the dashboard's recent-orders list
// does; kept as an alias so the shared OrderStatusChip and formatters apply
// unchanged. If the list gains order-only fields later, widen this type.
export type Order = DashboardOrder;

/*
 * Filter tabs across the top of the list. Each maps to a server-side filter;
 * `all` is the default. The label and the set are fixed navigation, not
 * customer data, so they live with the UI — only the counts come from the API.
 */
export type OrderFilter = 'all' | 'active' | 'completed' | 'attention';

export type OrderFilterCounts = Record<OrderFilter, number>;

/*
 * Cursor pagination, mirroring the API envelope (AGENTS.md, API Conventions).
 * Desktop and tablet render the page counter + Previous/Next; mobile renders
 * "Load more" over the same cursor.
 */
export type OrdersPage = {
  orders: Order[];
  counts: OrderFilterCounts;
  page: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
  // Cursor for the next page (AGENTS.md, cursor pagination); null when the list
  // is exhausted. Drives "Load more" (mobile) and Next (desktop).
  nextCursor: string | null;
};

/*
 * Single order detail — the shapes the order-detail screen renders. Same
 * source-of-truth rule as the list: the backend owns these; the mirror exists
 * so the screen composes before the endpoint lands. Money stays integer minor
 * units + ISO code (AGENTS.md, Money rules) — formatted only at render.
 */

/*
 * The order-detail timeline is a fixed five-stage lifecycle, distinct from the
 * `OrderStatus` chip: an order sits at one stage, earlier stages are done, later
 * ones are upcoming. `state` is derived from the order's position in the flow,
 * so the same set of steps renders at every width. `date` is optional — an
 * upcoming step may carry an estimate label ("Est. 5–7 business days") or none.
 */
export type OrderTimelineState = 'done' | 'current' | 'upcoming';

export type OrderTimelineStep = {
  key: string;
  label: string;
  date?: string; // free-text: an ISO date the UI formats, or an estimate label
};

export type OrderTimeline = {
  steps: OrderTimelineStep[];
  currentIndex: number; // steps before this are done, after are upcoming
};

// One labelled row in the Application details / Order information cards.
export type OrderDetailField = {
  label: string;
  value: string;
};

/*
 * A generated order document. `available` gates the download — a pending
 * document has nothing to fetch yet, so its action renders disabled. `href` is
 * the short-TTL presigned URL the backend hands out after its ownership check
 * (AGENTS.md, Security & PII); absent until the document is available.
 */
export type OrderDocument = {
  id: string;
  name: string;
  available: boolean;
  href?: string;
};

// One line of the order summary. `emphasis` marks the discount/credit line the
// design tints green; `amount` is signed minor units (a discount is negative).
export type OrderSummaryLine = {
  label: string;
  amount: Money;
  emphasis?: boolean;
};

export type OrderSummary = {
  lineItems: OrderSummaryLine[];
  subtotal: Money;
  discount?: Money; // negative minor units when present
  total: Money;
};

export type PaymentState = 'paid' | 'pending' | 'failed';

export type OrderPayment = {
  state: PaymentState;
  fields: OrderDetailField[]; // method, date, transaction id
};

/*
 * An entry in the order's activity feed. `author` is either the customer or the
 * Marty Global team (the team entries carry the TEAM tag and a monogram avatar);
 * `avatarUrl` is present for a person, absent for the team monogram.
 */
export type OrderActivityAuthor = 'team' | 'customer';

export type OrderActivityEntry = {
  id: string;
  author: OrderActivityAuthor;
  authorName: string;
  avatarUrl?: string;
  occurredAt: string; // ISO-8601 UTC
  message: string;
};

export type OrderDetail = {
  id: string;
  reference: string; // "ORD-10432"
  serviceName: string; // "LLC Formation — USA"
  status: OrderStatus;
  submittedAt: string; // ISO-8601 UTC
  timeline: OrderTimeline;
  applicationDetails: OrderDetailField[];
  documents: OrderDocument[];
  activity: OrderActivityEntry[];
  summary: OrderSummary;
  payment: OrderPayment;
  orderInformation: OrderDetailField[];
};
