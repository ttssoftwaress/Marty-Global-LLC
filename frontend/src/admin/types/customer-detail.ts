/*
 * Admin customer detail — local mirror of the API shapes the single-customer
 * screen renders. The backend is the source of truth (AGENTS.md, two-apps sync
 * rule); these types exist so the UI compiles and composes before the endpoints
 * land.
 *
 * Nothing on the screen is hardcoded business data: the identity block, the four
 * KPI figures, the tab set, and the orders themselves all arrive from the API.
 */

import type { Money, OrderStatus } from './dashboard';

export type { Money, OrderStatus };

/*
 * The tabs across the middle of the screen. Only `orders` has a built panel —
 * the rest render a "coming soon" panel in the same frame, so the screen is
 * complete at every tab rather than dead-ending on four of five.
 *
 * A closed union (rather than free strings) is what lets the screen hold one in
 * the URL and read it back without validating against the server first.
 */
export type CustomerDetailTab =
  | 'profile'
  | 'orders'
  | 'payments'
  | 'mailroom'
  | 'messages';

export const CUSTOMER_DETAIL_TABS: { value: CustomerDetailTab; label: string }[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'orders', label: 'Orders' },
  { value: 'payments', label: 'Payments' },
  { value: 'mailroom', label: 'Mail room' },
  { value: 'messages', label: 'Messages' },
];

export const DEFAULT_CUSTOMER_DETAIL_TAB: CustomerDetailTab = 'orders';

export function isCustomerDetailTab(value: unknown): value is CustomerDetailTab {
  return CUSTOMER_DETAIL_TABS.some((tab) => tab.value === value);
}

/*
 * The four figures across the top. `value` arrives pre-resolved as either a
 * count or money so the backend owns the figure and the UI only formats it — no
 * client-side math on an amount (AGENTS.md, Money rules).
 *
 * `id` picks the card's glyph from a fixed map; an id the frontend does not know
 * still renders with a neutral fallback icon rather than dropping the card.
 */
export type CustomerMetricId =
  | 'total-orders'
  | 'total-spent'
  | 'active-orders'
  | 'open-mail-items';

export type CustomerMetricValue =
  | { kind: 'count'; count: number }
  | { kind: 'money'; money: Money };

export type CustomerMetric = {
  id: CustomerMetricId | (string & {});
  label: string;
  value: CustomerMetricValue;
};

/*
 * The customer's identity block.
 *
 * `initials` comes from the backend rather than being sliced off the name here,
 * so a two-word Latin name and a single-glyph script both render correctly — the
 * same rule the customers list follows.
 *
 * `country.flag` is the emoji the chip prints: text, not an asset, so it comes
 * down with the record; a country without one renders the code alone.
 *
 * `customerSince` is ISO-8601 UTC and becomes "Customer since Jan 2026" at
 * render. `status` drives the Active pill; the label is the backend's word for
 * it so a wording change never needs a frontend deploy.
 */
export type CustomerAccountStatus = 'active' | 'inactive' | 'suspended';

export type AdminCustomerDetail = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  country: { code: string; name: string; flag?: string };
  status: CustomerAccountStatus;
  statusLabel: string;
  /*
   * The suspension. `isBanned` is the live state — a lapsed ban reads as false,
   * because the backend's guards let that account sign in and the screen must not
   * disagree with them. `banReason` is the note whoever suspended it left, and is
   * only present while the suspension is live.
   *
   * `canBan` is the backend answering whether this member holds `customers.ban`.
   * The screen reads it rather than deriving one from the permission list, so the
   * control is never offered where the endpoint would refuse it — and, like every
   * other guard in this app, it hides nothing the server would have released.
   */
  isBanned: boolean;
  banReason: string | null;
  canBan: boolean;
  customerSince: string | null; // ISO-8601 UTC
  metrics: CustomerMetric[];
  messageThreadTo: string | null; // the conversation the Message button opens
};

/*
 * One of the customer's orders. `reference` is the "#ORD-1847" the design
 * prints; `statusLabel` is the backend's word for the status, so the chip map
 * here only decides the glyph and hue.
 */
export type CustomerOrderRow = {
  id: string;
  reference: string;
  service: string;
  submittedAt: string; // ISO-8601 UTC
  status: OrderStatus;
  statusLabel: string;
  to: string; // the order's detail route
};

/*
 * One page of the customer's orders. Cursor pagination is the API convention
 * (AGENTS.md), so `nextCursor` drives the "Load more" control under the list.
 */
export type CustomerOrdersPage = {
  orders: CustomerOrderRow[];
  nextCursor: string | null;
  totalResults: number;
};
