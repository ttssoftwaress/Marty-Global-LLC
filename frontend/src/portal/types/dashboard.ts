/*
 * Portal dashboard — local mirror of the API shapes the dashboard renders.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule); these
 * types exist so the UI compiles and composes before the endpoints land.
 *
 * Money is never a float: amounts are integer minor units plus an ISO 4217
 * code, formatted only at render.
 */

export type Money = {
  amount: number; // integer minor units — 1250 = $12.50
  currency: string; // ISO 4217, e.g. "USD"
};

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'missing_info'
  | 'approved'
  | 'completed';

export type DashboardOrder = {
  id: string;
  reference: string; // customer-facing id, e.g. "ORD-10432"
  serviceName: string;
  submittedAt: string; // ISO-8601 UTC
  status: OrderStatus;
};

export type ActivityTone = 'info' | 'success' | 'alert';

export type ActivityAction = {
  label: string;
  to: string;
};

/*
 * `message` arrives as segments so the emphasised parts (order references,
 * amounts, room names) stay data rather than markup parsed out of a string.
 */
export type ActivitySegment = {
  text: string;
  emphasis?: boolean;
};

export type DashboardActivity = {
  id: string;
  tone: ActivityTone;
  icon: 'order' | 'mail' | 'payment' | 'alert';
  message: ActivitySegment[];
  occurredAt: string; // ISO-8601 UTC
  action?: ActivityAction;
};

export type DashboardMetrics = {
  activeOrders: number;
  amountDue: Money;
  unreadMail: number;
  pendingMessages: number;
};

export type BillingSummary = {
  amountDue: Money;
  totalPaid: Money;
  pendingQuotes: number;
};

export type MailRoomSummary = {
  totalRooms: number;
  unreadMail: number;
  pendingRequests: number;
};

export type AccountStatus = 'active' | 'action_required' | 'suspended';

export type DashboardSummary = {
  customerFirstName: string;
  accountStatus: AccountStatus;
  metrics: DashboardMetrics;
  recentOrders: DashboardOrder[];
  recentActivity: DashboardActivity[];
  billing: BillingSummary;
  mailRooms: MailRoomSummary;
};
