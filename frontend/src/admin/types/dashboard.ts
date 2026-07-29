/*
 * Admin dashboard — local mirror of the API shapes the admin home screen
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * these types exist so the UI compiles and composes before the endpoints land.
 *
 * Money is never a float: amounts are integer minor units plus an ISO 4217
 * code, formatted only at render.
 */

export type Money = {
  amount: number; // integer minor units — 1250 = $12.50
  currency: string; // ISO 4217, e.g. "USD"
};

/*
 * The period the whole screen is scoped to. The segmented pill sets it and the
 * query re-fetches, so every figure on the page belongs to the same window.
 */
export type DashboardPeriod = 'today' | 'week' | 'month';

/*
 * A KPI's footer sits beside a trend. `direction` picks the arrow and hue
 * (up = success, down = error, flat = no arrow, warning tint) — the backend
 * decides which way is good for the metric, so the UI never has to.
 */
export type MetricTrendDirection = 'up' | 'down' | 'flat';

export type MetricTrend = {
  direction: MetricTrendDirection;
  label: string; // e.g. "+3 this week", "Awaiting client"
};

/*
 * A KPI card. `value` arrives pre-resolved as either a count or money so the
 * backend owns the figure and the UI only formats it — no client-side math on
 * an amount (AGENTS.md, Money rules).
 */
export type DashboardMetricValue =
  | { kind: 'count'; count: number }
  | { kind: 'money'; money: Money };

export type DashboardMetric = {
  id: string;
  label: string; // e.g. "New applications"
  value: DashboardMetricValue;
  caption: string; // e.g. "Awaiting review"
  trend: MetricTrend;
};

// The pipeline, in order. Mirrors the backend's `OrderStatus` enum — the backend
// is the source of truth (AGENTS.md, two-apps sync rule).
export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'missing_info'
  | 'approved'
  | 'paid'
  | 'processing'
  | 'completed';

export type OrderStatusCount = {
  status: OrderStatus;
  label: string;
  count: number;
};

export type ActivityKind =
  | 'application'
  | 'payment'
  | 'document'
  | 'approval'
  | 'quote'
  | 'mail';

export type DashboardActivity = {
  id: string;
  kind: ActivityKind; // picks the row's icon and chip tint
  message: string;
  occurredAt: string; // ISO-8601 UTC
  to?: string; // the record this row links to, when there is one
};

/*
 * A "Needs attention" row. `emphasis` drives the action button's weight:
 * outline for routine work, solid navy when it is overdue, solid accent when it
 * is blocking a customer — so the queue reads by urgency rather than order.
 */
export type AttentionEmphasis = 'default' | 'urgent' | 'critical';

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  to: string;
  emphasis: AttentionEmphasis;
};

/*
 * How much of the business this screen covers. The dashboard carries no
 * permission of its own — every staff member lands here — so scoping is the only
 * access control on it, and the backend decides it and sends it down. The page
 * prints it rather than deriving it from a role: "8 new applications" and "8 new
 * applications assigned to you" are the same number meaning very different
 * things (AGENTS.md, Auth).
 */
export type DashboardScope = 'all' | 'assigned';

export type AdminDashboardSummary = {
  period: DashboardPeriod;
  scope: DashboardScope;
  metrics: DashboardMetric[];
  ordersByStatus: OrderStatusCount[];
  recentActivity: DashboardActivity[];
  attention: {
    total: number;
    items: AttentionItem[];
  };
};
