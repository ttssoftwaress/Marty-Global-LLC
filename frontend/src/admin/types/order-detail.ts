/*
 * Admin order detail — local mirror of the API shapes the staff order screen
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * this file is the frontend's copy of `GET /v1/admin/orders/:orderId`.
 *
 * The screen decides nothing about the order on its own. Which statuses may be
 * set, what each is called, who the order can be handed to, and whether a
 * document can be downloaded all arrive with the record — the pipeline and the
 * permission rules behind them live in the backend, and a second copy of them
 * here would be the one an operator sees when the two disagree.
 */

import type { Money } from './dashboard';
import type { OrderParty, OrderStatus } from './orders';

export type { Money, OrderParty, OrderStatus };

/*
 * An entry in the order's feed. Three authors: the team, the customer, and the
 * system (an entry written by a job rather than a person).
 *
 * `internal` is the flag the whole "respond" flow turns on — an internal note is
 * staff-only and is never sent to the customer's own order page. It is rendered
 * distinctly here precisely so nobody writes one believing the customer will
 * read it.
 */
export type AdminOrderActivityAuthor = 'team' | 'customer' | 'system';

export type AdminOrderActivityEntry = {
  id: string;
  author: AdminOrderActivityAuthor;
  authorName: string;
  initials: string;
  internal: boolean;
  occurredAt: string; // ISO-8601 UTC
  message: string;
};

/*
 * A document on the order. `status` gates what can be done with it: only an
 * `available` row has a file behind it. The download URL is not part of this
 * shape — it is a short-TTL presigned link the backend issues per request after
 * its own ownership check (AGENTS.md, Security & PII), never a field that sits
 * in a cached query.
 */
export type AdminOrderDocumentStatus = 'pending' | 'available' | 'rejected';

export type AdminOrderDocument = {
  id: string;
  name: string;
  status: AdminOrderDocumentStatus;
  statusLabel: string;
  source: 'team' | 'customer';
  sizeBytes: number | null;
  createdAt: string; // ISO-8601 UTC
};

/*
 * One step of the pipeline as this actor may use it. Every status travels, so
 * the control can draw the whole flow; `allowed` says which of them this order
 * can move to from where it stands, and `current` marks where it is.
 *
 * A staff member advances one step at a time; an admin may set any status. That
 * rule is the backend's — the difference simply shows up in these flags.
 */
export type AdminOrderStatusOption = {
  value: OrderStatus;
  label: string;
  allowed: boolean;
  current: boolean;
  /*
   * Why a step is out of reach, when the reason is the order's own history rather
   * than the pipeline or this actor's role. Only `quote_required` today: an order
   * cannot be approved before it has been priced, because APPROVED is what tells
   * the customer to go and pay.
   *
   * The screen prints this as an explanation and points at the quote composer.
   * The backend enforces it — a hand-crafted PATCH gets a 422 either way.
   */
  blockedReason?: 'quote_required';
};

// A staff member the order can be assigned to — active, and holding the orders
// area. `roleLabel` is their job role ("Reviewer / Compliance"), not their auth
// role.
export type AdminOrderAssigneeOption = {
  value: string;
  label: string;
  initials: string;
  roleLabel: string;
};

/*
 * One service on the application, with the customer's answers already resolved
 * to their human labels. Grouped per service rather than flattened, because two
 * services can ask for the same field name.
 *
 * The delivery half is per item rather than per order because an order groups
 * several services that do not finish together — a mail room can be live weeks
 * before a formation clears — so "completed" is answerable per line or not at
 * all. `deliversResult` says whether this line has a result form: not every
 * service returns something the customer looks at afterwards, and one that
 * doesn't completes with a plain status change instead.
 */
export type AdminOrderItemStatus = 'pending' | 'in_progress' | 'completed';

export type AdminOrderItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  fields: { label: string; value: string }[];
  status: AdminOrderItemStatus;
  completedAt: string | null; // ISO-8601 UTC
  deliversResult: boolean;
  resultId: string | null;
  // `draft` is filled but not yet delivered — invisible to the customer.
  resultStatus: 'draft' | 'active' | 'archived' | null;
};

export type AdminOrderCustomer = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  to: string; // the customer's record
  messageThreadTo: string | null; // null when no conversation exists yet
};

export type AdminOrderDetail = {
  id: string;
  reference: string;
  status: OrderStatus;
  statusLabel: string;
  submittedAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
  region: { name: string; flag?: string };
  notes: string | null; // the customer's free-text note from the application
  customer: AdminOrderCustomer;
  assignee: (OrderParty & { id: string }) | null;
  items: AdminOrderItem[];
  documents: AdminOrderDocument[];
  activity: AdminOrderActivityEntry[];
  statusOptions: AdminOrderStatusOption[];
  assigneeOptions: AdminOrderAssigneeOption[];
  /*
   * Whether this actor may hand the order to someone else (`orders.assign`).
   * The backend decides it — the disabled control and the endpoint's 403 have to
   * agree, and the endpoint is the real boundary (AGENTS.md, Auth).
   */
  canAssign: boolean;
};

/*
 * A quote raised against this order. MONEY: integer minor units + ISO 4217,
 * formatted only at render (AGENTS.md, Money).
 */
export type AdminQuoteStatus =
  | 'draft'
  | 'pending'
  | 'paid'
  | 'expired'
  | 'cancelled';

export type AdminQuoteLineItem = {
  id: string;
  label: string;
  amount: Money;
};

export type AdminQuote = {
  id: string;
  reference: string;
  status: AdminQuoteStatus;
  statusLabel: string;
  serviceName: string;
  lineItems: AdminQuoteLineItem[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  issuedAt: string; // ISO-8601 UTC
  validUntil: string; // ISO-8601 UTC
  paidAt: string | null;
};

/*
 * A pricing template the composer can quote from — one `ServicePricingTier` an
 * admin authored on the service catalog's "Pricing & quote templates" card,
 * already narrowed by the backend to this order's services and region.
 *
 * Picking one appends a line; it does not lock the quote. A template is a
 * shortcut past retyping an agreed price, and every line stays editable after it
 * lands, so a custom quote costs exactly what it did before.
 *
 * MONEY: `price` is integer minor units + ISO 4217, formatted only at render
 * (AGENTS.md, Money).
 */
export type AdminQuoteTemplate = {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  price: Money;
  description: string | null;
  turnaround: string | null;
  regionCode: string | null;
};

/*
 * Sending a quote. There is no `total` field: the client never decides an
 * amount — the backend sums the lines and stores the result (AGENTS.md, Money).
 * Amounts are integer minor units, so the form parses its inputs to cents before
 * they reach this shape.
 */
export type CreateQuoteInput = {
  serviceName?: string;
  lineItems: { label: string; amount: number }[];
  tax: number;
  discount: number;
  currency: string;
  validForDays: number;
  message?: string;
};

// Moving an order — a state change the customer sees as a status. Correspondence
// is not here: that is the order conversation, its own module.
export type AdminOrderUpdate = {
  status?: OrderStatus;
  // Null unassigns. Absent leaves the assignee alone — the two are different
  // requests, so this is `string | null | undefined` on purpose.
  assigneeId?: string | null;
};

// The actions card's "Unassigned" choice. The select works in strings; this is
// the one the mutation translates back to the `null` the API takes.
export const UNASSIGNED = '';
