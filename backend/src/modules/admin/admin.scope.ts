import type { Prisma } from '@prisma/client';

import type { AuthContext } from '../../guards/auth-context.js';
import { canSeeAll } from './admin.guards.js';

/*
 * Row-level scoping for the admin portal — the query half of the team screen's
 * "All data" column.
 *
 * `requirePermission` answers whether a member may open a section.
 * `canSeeAll` answers whether that section shows them the org or only their own
 * work. This file is what "their own work" means as a Prisma `where` clause, for
 * each model the admin portal reads.
 *
 * Everything here hangs off one fact: **`Order.assigneeId` is the only ownership
 * the schema records.** A staff member owns orders; they own a customer, a
 * quote, a payment, or a mail item only because it hangs off an order they hold.
 * So every clause below is a path back to that column, and the shapes are
 * centralised here rather than inlined per service — a three-hop nested filter
 * written twice is a leak waiting for the second copy to drift.
 *
 * Two rules hold everywhere:
 *
 *   - The scope is a `where` clause, never a filter over results. A member must
 *     not be able to reach a record by typing its id, so the boundary has to be
 *     in the query (AGENTS.md: the backend guards are the real boundary).
 *   - It applies to the `count` as well as the `findMany`. They are separate
 *     calls in every list here, and scoping only the rows leaves a total that
 *     tells the member exactly how much they were not shown.
 *
 * Unowned records (a quote raised with no order, a customer who has never
 * ordered) match no staff scope and are visible only to the unscoped. That is
 * deliberate: with no assignee there is nobody they belong to, and inventing a
 * fallback owner would hand every staff member the orphans.
 */

/*
 * The empty clause. Spreading `{}` into a `where` adds nothing, which is what
 * makes every call site below a uniform spread regardless of the answer — no
 * conditional query building, no branch that might forget a filter.
 */
const UNSCOPED = {} as const;

// --- Order ---------------------------------------------------------------
export async function orderScope(
  actor: AuthContext,
): Promise<Prisma.OrderWhereInput> {
  return (await canSeeAll(actor, 'orders'))
    ? UNSCOPED
    : { assigneeId: actor.userId };
}

// --- Quote ---------------------------------------------------------------
// Quote.orderId is nullable: a quote raised outside an order has no owner.
export async function quoteScope(
  actor: AuthContext,
): Promise<Prisma.QuoteWhereInput> {
  return (await canSeeAll(actor, 'payments'))
    ? UNSCOPED
    : { order: { is: { assigneeId: actor.userId } } };
}

// --- Payment -------------------------------------------------------------
// Payment → Quote → Order. Both hops are nullable, so a payment reaches an
// assignee only when the whole chain is intact.
export async function paymentScope(
  actor: AuthContext,
): Promise<Prisma.PaymentWhereInput> {
  return (await canSeeAll(actor, 'payments'))
    ? UNSCOPED
    : { quote: { is: { order: { is: { assigneeId: actor.userId } } } } };
}

/*
 * --- Customer ------------------------------------------------------------
 *
 * `some`, not a single value: a customer with five orders across three staff is
 * a customer all three deal with, so all three see the record. The alternative —
 * one owner per customer — is not a thing the schema records, and inventing it
 * would hide a customer from the very person handling their live filing.
 *
 * `deletedAt: null` on the inner order matters. Without it a soft-deleted order
 * would keep granting its assignee a customer they no longer work with.
 */
export async function customerScope(
  actor: AuthContext,
): Promise<Prisma.UserWhereInput> {
  return (await canSeeAll(actor, 'customers'))
    ? UNSCOPED
    : { orders: { some: { assigneeId: actor.userId, deletedAt: null } } };
}

/*
 * The customer path as it applies to a model that hangs off a customer rather
 * than off an order — the mail room's shape. Kept as one helper so the mailroom
 * models below cannot drift from `customerScope`.
 */
function ownedCustomer(actor: AuthContext): Prisma.UserWhereInput {
  return { orders: { some: { assigneeId: actor.userId, deletedAt: null } } };
}

/*
 * --- Mail room -----------------------------------------------------------
 *
 * Mail hangs off a customer, not an order, so the scope is "customers I deal
 * with" — one hop further out than the rest of this file.
 *
 * Worth stating plainly: a mail operator's role holds `mailroom` and `customers`
 * and no `orders` grant, so scoping them by order assignment shows them an empty
 * room. That is why `mail-operator` ships with `mailroom.all` off but is the
 * role an admin is most likely to widen — the switch is in the grid for exactly
 * that case. The alternative would be a per-operator mail assignment, which is
 * a schema change, not a permission one.
 */
export async function mailRoomScope(
  actor: AuthContext,
): Promise<Prisma.MailRoomWhereInput> {
  return (await canSeeAll(actor, 'mailroom'))
    ? UNSCOPED
    : { customer: { is: ownedCustomer(actor) } };
}

export async function mailItemScope(
  actor: AuthContext,
): Promise<Prisma.MailItemWhereInput> {
  return (await canSeeAll(actor, 'mailroom'))
    ? UNSCOPED
    : { room: { is: { customer: { is: ownedCustomer(actor) } } } };
}

export async function mailRequestScope(
  actor: AuthContext,
): Promise<Prisma.MailRequestWhereInput> {
  return (await canSeeAll(actor, 'mailroom'))
    ? UNSCOPED
    : { customer: { is: ownedCustomer(actor) } };
}

/*
 * MailActionLog carries a bare `customerId` column with no `customer` relation
 * field, so it cannot be filtered the way its siblings are. It reaches a
 * customer through the mail item instead — the same destination, one hop wider.
 */
export async function mailLogScope(
  actor: AuthContext,
): Promise<Prisma.MailActionLogWhereInput> {
  return (await canSeeAll(actor, 'mailroom'))
    ? UNSCOPED
    : { mailItem: { is: { room: { is: { customer: { is: ownedCustomer(actor) } } } } } };
}

/*
 * --- Reporting -------------------------------------------------------------
 *
 * Reports read Order and Payment directly but under their own area: a reviewer
 * holds `reports` by default, and whether their charts cover the org is a
 * `reports` decision, not a `payments` one. Same clauses, different question.
 */
export async function reportOrderScope(
  actor: AuthContext,
): Promise<Prisma.OrderWhereInput> {
  return (await canSeeAll(actor, 'reports'))
    ? UNSCOPED
    : { assigneeId: actor.userId };
}

export async function reportPaymentScope(
  actor: AuthContext,
): Promise<Prisma.PaymentWhereInput> {
  return (await canSeeAll(actor, 'reports'))
    ? UNSCOPED
    : { quote: { is: { order: { is: { assigneeId: actor.userId } } } } };
}

export async function reportCustomerScope(
  actor: AuthContext,
): Promise<Prisma.UserWhereInput> {
  return (await canSeeAll(actor, 'reports'))
    ? UNSCOPED
    : { orders: { some: { assigneeId: actor.userId, deletedAt: null } } };
}

/*
 * --- Dashboard -------------------------------------------------------------
 *
 * The dashboard is the one surface with no permission area of its own — every
 * staff member lands on it, so it cannot ask "do you hold this section". It
 * scopes on `orders` instead, which is the closest thing to "is this person an
 * overseer", and it is the reason a mail operator no longer reads org revenue
 * off the home screen.
 */
export async function dashboardOrderScope(
  actor: AuthContext,
): Promise<Prisma.OrderWhereInput> {
  return (await canSeeAll(actor, 'orders'))
    ? UNSCOPED
    : { assigneeId: actor.userId };
}

export async function dashboardPaymentScope(
  actor: AuthContext,
): Promise<Prisma.PaymentWhereInput> {
  return (await canSeeAll(actor, 'orders'))
    ? UNSCOPED
    : { quote: { is: { order: { is: { assigneeId: actor.userId } } } } };
}

export async function dashboardCustomerScope(
  actor: AuthContext,
): Promise<Prisma.UserWhereInput> {
  return (await canSeeAll(actor, 'orders'))
    ? UNSCOPED
    : { orders: { some: { assigneeId: actor.userId, deletedAt: null } } };
}

export async function dashboardQuoteScope(
  actor: AuthContext,
): Promise<Prisma.QuoteWhereInput> {
  return (await canSeeAll(actor, 'orders'))
    ? UNSCOPED
    : { order: { is: { assigneeId: actor.userId } } };
}

export async function dashboardMailItemScope(
  actor: AuthContext,
): Promise<Prisma.MailItemWhereInput> {
  return (await canSeeAll(actor, 'orders'))
    ? UNSCOPED
    : { room: { is: { customer: { is: ownedCustomer(actor) } } } };
}

export async function dashboardMailRequestScope(
  actor: AuthContext,
): Promise<Prisma.MailRequestWhereInput> {
  return (await canSeeAll(actor, 'orders'))
    ? UNSCOPED
    : { customer: { is: ownedCustomer(actor) } };
}

/*
 * --- Service request -----------------------------------------------------
 *
 * The one model in this file with ownership of its own. Every other scope traces
 * a path back to `Order.assigneeId`, because that is the only ownership the rest
 * of the schema records — but a request is assigned directly, so "mine" is the
 * column itself.
 *
 * The extra `assigneeId: null` clause is what makes the queue workable rather
 * than merely correct. A scoped member must see the unclaimed backlog or nobody
 * could ever pick anything up: a queue showing only what you already hold has
 * nothing left to claim from, which would make the whole screen a dead end. This
 * mirrors how the support inbox treats unassigned threads — a shared pool plus
 * your own work.
 */
export async function serviceRequestScope(
  actor: AuthContext,
): Promise<Prisma.ServiceRequestWhereInput> {
  return (await canSeeAll(actor, 'requests'))
    ? UNSCOPED
    : { OR: [{ assigneeId: actor.userId }, { assigneeId: null }] };
}

/*
 * The word the UI prints for what it is showing. It travels with every scoped
 * summary because "12 orders" and "12 orders assigned to you" are the same
 * number with very different meanings, and the browser must not infer which from
 * a role it does not hold.
 */
export type DataScope = 'all' | 'assigned';

export function scopeLabel(seesAll: boolean): DataScope {
  return seesAll ? 'all' : 'assigned';
}
