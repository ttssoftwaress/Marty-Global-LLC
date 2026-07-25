/*
 * Admin orders queue — local mirror of the API shapes the queue screen renders.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule); these
 * types exist so the UI compiles and composes before the endpoints land.
 *
 * Nothing on the screen is hardcoded business data: counts, filter options, the
 * rows themselves, and the region flags all arrive from the API.
 */

import type { OrderStatus } from './dashboard';

export type { OrderStatus };

/*
 * The status tab set. `all` is the unfiltered view the queue opens on; every
 * other value narrows to one order status.
 */
export type OrderStatusFilter = OrderStatus | 'all';

/*
 * A status tab. The backend supplies the label and the count so the tab strip
 * stays in step with whatever statuses the pipeline actually uses — the UI never
 * derives a count from the current page of rows.
 */
export type OrderStatusTab = {
  value: OrderStatusFilter;
  label: string;
  count: number;
};

/*
 * A dropdown option for the service / region / date-range filters. Values are
 * opaque to the UI — they go back to the API verbatim as query params.
 */
export type OrderFilterOption = {
  value: string;
  label: string;
};

/*
 * The three dropdown filters, applied together. `all` is the pass-through value
 * for each; the option lists arrive from the API alongside them so the admin can
 * only pick a service or region that exists.
 */
export type OrderFilters = {
  service: string;
  region: string;
  dateRange: string;
};

export const DEFAULT_ORDER_FILTERS: OrderFilters = {
  service: 'all',
  region: 'all',
  dateRange: 'all',
};

export type OrderFilterOptions = {
  services: OrderFilterOption[];
  regions: OrderFilterOption[];
  dateRanges: OrderFilterOption[];
};

/*
 * The person a row is about, and the staff member it is assigned to. `initials`
 * comes from the backend rather than being sliced off the name here, so a
 * two-word Latin name and a single-glyph script both render correctly.
 */
export type OrderParty = {
  name: string;
  initials: string;
};

/*
 * A queue row. `region.flag` is the emoji the design shows beside the region
 * name — text, not an asset, so it comes down with the row; a region without one
 * simply renders the name.
 *
 * `actionLabel` is the backend's word for what this row's button does ("Review"
 * on open work, "View" once it is closed), so the queue never has to infer an
 * action from a status.
 */
export type AdminOrderRow = {
  id: string;
  reference: string; // the "#ORD-2847" the design prints
  customer: OrderParty;
  service: string;
  region: { name: string; flag?: string };
  submittedAt: string; // ISO-8601 UTC
  status: OrderStatus;
  statusLabel: string;
  assignee: OrderParty | null; // null renders as "Unassigned"
  actionLabel: string;
  to: string; // the order's detail route
};

/*
 * One page of the queue plus everything the chrome around it needs. Cursor
 * pagination is the API convention (AGENTS.md), so `nextCursor` drives mobile's
 * "Load more"; `page`/`totalPages` drive the numbered pager the wider links
 * show.
 */
export type AdminOrdersPage = {
  orders: AdminOrderRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number; // total matching the current filters
};

/*
 * The queue's header figures and filter chrome — one call, so the tab counts and
 * the two header pills agree with each other and with the list.
 */
export type AdminOrdersSummary = {
  totalOrders: number;
  awaitingReview: number;
  tabs: OrderStatusTab[];
  filterOptions: OrderFilterOptions;
};
