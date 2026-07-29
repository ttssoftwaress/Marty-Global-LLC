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
 *
 * There is no `page` here because a cursor stream has no offset to report — the
 * screen owns which window it is showing, and the backend supplies only the
 * "of Y" half of the counter.
 */
export type OrdersPage = {
  orders: Order[];
  counts: OrderFilterCounts;
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
 *
 * Two of the three values, not three: the backend's `OrderActivityAuthor` enum
 * also has SYSTEM, and `orders.service.ts` deliberately collapses it to `team`
 * on this wire — a system-authored entry is the business writing to the customer
 * exactly as a team one is, and this screen draws both with the same monogram.
 * The admin mirror keeps all three because that screen does tell them apart.
 * Widening this would add a branch the wire can never produce.
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

/*
 * The quote the team sent on this order. Null until one is raised, which is what
 * keeps the summary card in its "awaiting quote" state rather than showing a
 * fabricated price.
 *
 * `payable` is the backend's decision, not one the browser re-derives from the
 * status and the date: the Pay button and the payment endpoint have to agree,
 * and the endpoint is the real boundary (AGENTS.md, Auth).
 */
/*
 * Four of the backend enum's five. DRAFT is missing on purpose: an unsent draft
 * is internal to the admin's quote builder, and the customer's order query
 * filters it out (`orders.service.ts`, the `quotes` include) so this screen is
 * never handed a price nobody has sent. Do not add `draft` here without
 * removing that filter — the two are one decision.
 *
 * The admin's own mirror carries all five (`AdminQuoteStatus` in
 * `admin/types/order-detail.ts`), as does
 * checkout's `CheckoutQuoteStatus` (`portal/types/payments.ts`), which sees a
 * quote by id rather than through the order's filter.
 */
export type QuoteStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export type OrderQuote = {
  id: string;
  reference: string; // "QT-10432"
  status: QuoteStatus;
  serviceName: string;
  lineItems: OrderSummaryLine[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  issuedAt: string; // ISO-8601 UTC
  validUntil: string; // ISO-8601 UTC
  paidAt: string | null;
  payable: boolean;
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
  quote: OrderQuote | null;
  summary: OrderSummary;
  payment: OrderPayment;
  orderInformation: OrderDetailField[];
};
