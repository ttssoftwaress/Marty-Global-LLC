/*
 * Admin customers list — local mirror of the API shapes the customers screen
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * these types exist so the UI compiles and composes before the endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the total, the tab set, the
 * region options, and the rows themselves all arrive from the API.
 */

import type { Money } from './dashboard';

export type { Money };

/*
 * The segment tabs above the list. `all` is the unfiltered view the screen opens
 * on; the rest narrow to a cohort the backend defines. Keeping them a closed
 * union (rather than free strings) is what lets the page hold one in state and
 * send it back as a query param without validating it first.
 */
export type CustomerSegment = 'all' | 'active' | 'has-open-orders' | 'no-orders';

/*
 * A segment tab. The label comes from the backend so the tab strip stays in step
 * with whatever cohorts the business actually uses — the UI never invents one.
 * `count` is optional: the links print bare labels here (unlike the orders
 * queue's counted tabs), so a backend that supplies counts gets them rendered
 * and one that does not still reads correctly.
 */
export type CustomerSegmentTab = {
  value: CustomerSegment;
  label: string;
  count?: number;
};

/*
 * A region option for the dropdown. Values are opaque to the UI — they go back
 * to the API verbatim as a query param.
 */
export type CustomerRegionOption = {
  value: string;
  label: string;
};

export const ALL_REGIONS = 'all';

/*
 * A customer row.
 *
 * `initials` comes from the backend rather than being sliced off the name here,
 * so a two-word Latin name and a single-glyph script both render correctly —
 * the same rule the orders queue follows.
 *
 * `region.flag` is the emoji the mobile link prints beside the name: text, not
 * an asset, so it comes down with the row; a region without one simply renders
 * the name.
 *
 * `totalSpent` is money — integer minor units plus a currency code, formatted
 * only at render (AGENTS.md, Money rules). `lastActivityAt` is ISO-8601 UTC and
 * becomes a relative phrase at render; it is null for a customer who has not
 * been seen yet.
 */
export type AdminCustomerRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  region: { name: string; flag?: string };
  totalOrders: number;
  totalSpent: Money;
  lastActivityAt: string | null;
  to: string; // the customer's profile route
};

/*
 * One page of the list plus the figures the footer prints. Cursor pagination is
 * the API convention (AGENTS.md), so `nextCursor` drives mobile's "Load more";
 * `page`/`totalPages` drive the numbered pager the wider links show.
 */
export type AdminCustomersPage = {
  customers: AdminCustomerRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number; // total matching the current filters
};

/*
 * Whether these counts cover the whole book or only the customers this actor
 * deals with. The backend scopes the list and the tab counts together and sends
 * the answer down, so the header says which figure it is printing instead of
 * deriving it from a role (AGENTS.md, Auth).
 */
export type CustomersScope = 'all' | 'assigned';

/*
 * The screen's header figure and filter chrome — one call, so the header pill,
 * the tabs, and the region options agree with each other and with the list.
 */
export type AdminCustomersSummary = {
  totalCustomers: number;
  scope: CustomersScope;
  tabs: CustomerSegmentTab[];
  regions: CustomerRegionOption[];
};
