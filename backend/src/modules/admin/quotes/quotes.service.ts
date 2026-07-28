import {
  FeedNotificationCategory,
  OrderActivityAuthor,
  OrderStatus,
  Prisma,
  QuoteStatus,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { queueEmail } from '../../notifications/notifications.service.js';
import { advanceOrderStatus } from '../../orders/orders.service.js';
import { orderScope } from '../admin.scope.js';
import { formatMoneyDisplay, iso, type Money } from '../admin.views.js';
import type { CreateQuoteInput } from './quotes.validation.js';

/*
 * Sending a customer a quote on their order — the priced offer the whole
 * quote-based flow has been building toward. `billing` owns what is owed
 * (AGENTS.md, Payments), so the Quote row this writes is the same one the
 * customer's billing screen already reads; this module is only the staff-side
 * write path.
 *
 * MONEY, throughout: integer minor units plus an ISO 4217 code. Nothing here
 * divides, rounds, multiplies, or calls toFixed — the total is an integer sum of
 * integer lines, and the browser formats at render (AGENTS.md, Money).
 *
 * Collecting the money is deliberately not here. A quote is an offer; taking
 * payment for it is the `payments` module, which is not built yet.
 */

// --- Reference generation ------------------------------------------------
// "QT-#####", the human-facing reference beside the order's own. Random rather
// than a count (a count race could collide); the unique constraint is the real
// guard and we retry on the rare collision, exactly as orders do.
function makeReference(): string {
  const n = 10_000 + Math.floor(Math.random() * 90_000);
  return `QT-${n}`;
}

async function createWithUniqueReference<T>(
  create: (reference: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await create(makeReference());
    } catch (error) {
      // P2002 = unique constraint violation (the reference collided) — retry.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        continue;
      }
      throw error;
    }
  }
  throw AppError.conflict('Could not allocate a unique quote reference');
}

// --- Views ---------------------------------------------------------------
export type AdminQuoteLineItem = { id: string; label: string; amount: Money };

export type AdminQuoteView = {
  id: string;
  reference: string;
  status: string;
  statusLabel: string;
  serviceName: string;
  lineItems: AdminQuoteLineItem[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  issuedAt: string;
  validUntil: string;
  paidAt: string | null;
};

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  [QuoteStatus.DRAFT]: 'Draft',
  [QuoteStatus.PENDING]: 'Awaiting payment',
  [QuoteStatus.PAID]: 'Paid',
  [QuoteStatus.EXPIRED]: 'Expired',
  [QuoteStatus.CANCELLED]: 'Cancelled',
};

const QUOTE_STATUS_VIEW: Record<QuoteStatus, string> = {
  [QuoteStatus.DRAFT]: 'draft',
  [QuoteStatus.PENDING]: 'pending',
  [QuoteStatus.PAID]: 'paid',
  [QuoteStatus.EXPIRED]: 'expired',
  [QuoteStatus.CANCELLED]: 'cancelled',
};

type QuoteRecord = Prisma.QuoteGetPayload<{
  include: { lineItems: true };
}>;

/*
 * A PENDING quote past its validity window reads as expired on this render
 * rather than waiting for a job to flip the row — the same rule the customer's
 * billing screen applies, so both sides of the desk agree on whether an offer is
 * still live.
 */
function effectiveStatus(quote: QuoteRecord, now: Date): QuoteStatus {
  if (quote.status === QuoteStatus.PENDING && quote.validUntil <= now) {
    return QuoteStatus.EXPIRED;
  }
  return quote.status;
}

export function toQuoteView(quote: QuoteRecord, now = new Date()): AdminQuoteView {
  const status = effectiveStatus(quote, now);
  const currency = quote.currency;

  return {
    id: quote.id,
    reference: quote.reference,
    status: QUOTE_STATUS_VIEW[status],
    statusLabel: QUOTE_STATUS_LABEL[status],
    serviceName: quote.serviceName,
    lineItems: [...quote.lineItems]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((line) => ({
        id: line.id,
        label: line.label,
        amount: { amount: line.amount, currency },
      })),
    subtotal: { amount: quote.subtotal, currency },
    discount: { amount: quote.discount, currency },
    tax: { amount: quote.tax, currency },
    total: { amount: quote.total, currency },
    issuedAt: iso(quote.issuedAt),
    validUntil: iso(quote.validUntil),
    paidAt: quote.paidAt ? iso(quote.paidAt) : null,
  };
}

// --- Read ----------------------------------------------------------------
// Every quote raised against one order, newest first. The order-detail screen
// renders these under the application so a reviewer can see what was already
// offered before sending another.
/*
 * These routes are mounted under `/orders/:orderId/quotes` but carry the
 * `payments` area rather than `orders` — a billing grant, deliberately separable
 * from working the queue. That makes the order lookup the only thing standing
 * between a `payments` holder and any order in the system, so the actor's order
 * scope belongs in its `where`: without it, a member who cannot open an order in
 * the queue could still read its pricing, and `createQuote` below could move its
 * status, by typing its id.
 *
 * The scope is `orderScope` — the orders one — even though the area is
 * `payments`. What is being reached is an order, so what governs it is whether
 * this actor may reach that order.
 */
export async function listOrderQuotes(
  actor: AuthContext,
  orderId: string,
): Promise<AdminQuoteView[]> {
  const order = await prisma.order.findFirst({
    where: { ...(await orderScope(actor)), id: orderId, deletedAt: null },
    select: { id: true },
  });

  if (!order) throw AppError.notFound('Order not found');

  // The order lookup above already proved this id is in scope, so the clause here
  // is redundant — kept because the boundary belongs in the query rather than in
  // a guard that happens to run first (admin.scope.ts).
  const quotes = await prisma.quote.findMany({
    where: { orderId, deletedAt: null, order: { is: await orderScope(actor) } },
    include: { lineItems: true },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  return quotes.map((quote) => toQuoteView(quote, now));
}

// --- Templates -----------------------------------------------------------
/*
 * The pricing templates a sender can quote this order from.
 *
 * These are the `ServicePricingTier` rows an admin authored on the service
 * catalog's "Pricing & quote templates" card — the reference prices that card
 * exists to hold. A sender picks one to fill the composer in a click instead of
 * retyping a price that is already agreed policy; a custom quote is still just as
 * available, because a template is a starting point, not a rate card the composer
 * enforces.
 *
 * Scoped to what this order is actually for: only the services on the order, and
 * within those only the tiers offered in the order's region (plus the tiers that
 * apply everywhere, `regionCode: null`). Offering a Delaware price on a UK filing
 * is exactly the mis-click a quick-select is supposed to prevent.
 *
 * MONEY: a tier's price is passed through as the integer minor units it is
 * stored as. Nothing here sums, converts, or re-prices — the composer sends its
 * lines back and `createQuote` does the arithmetic authoritatively.
 */
export type AdminQuoteTemplate = {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  price: Money;
  // Free text from the catalog ("Standard filing + Registered Agent (1 yr)"),
  // shown under the name so a sender can tell two similar tiers apart.
  description: string | null;
  turnaround: string | null;
  // Null for a tier that applies in every region the service is offered in.
  regionCode: string | null;
};

export async function listQuoteTemplates(
  actor: AuthContext,
  orderId: string,
): Promise<AdminQuoteTemplate[]> {
  const order = await prisma.order.findFirst({
    where: { ...(await orderScope(actor)), id: orderId, deletedAt: null },
    select: {
      regionCode: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        select: { serviceId: true, serviceName: true },
      },
    },
  });

  if (!order) throw AppError.notFound('Order not found');

  const serviceIds = [...new Set(order.items.map((item) => item.serviceId))];
  if (serviceIds.length === 0) return [];

  const tiers = await prisma.servicePricingTier.findMany({
    where: {
      deletedAt: null,
      serviceId: { in: serviceIds },
      service: { is: { deletedAt: null } },
      // A region-specific tier only applies to an order filed in that region; a
      // null-region tier applies to all of them.
      OR: [
        { regionCode: null },
        ...(order.regionCode ? [{ regionCode: order.regionCode }] : []),
      ],
    },
    orderBy: [{ serviceId: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      name: true,
      serviceId: true,
      price: true,
      currency: true,
      description: true,
      turnaround: true,
      regionCode: true,
      service: { select: { name: true } },
    },
  });

  // The name the order recorded at submission, falling back to the catalog's
  // current one — a service renamed since the order was placed should still read
  // as the customer's own application does.
  const orderedNames = new Map(
    order.items.map((item) => [item.serviceId, item.serviceName]),
  );

  return tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    serviceId: tier.serviceId,
    serviceName: orderedNames.get(tier.serviceId) ?? tier.service.name,
    price: { amount: tier.price, currency: tier.currency },
    description: tier.description,
    turnaround: tier.turnaround,
    regionCode: tier.regionCode,
  }));
}

// --- Write ---------------------------------------------------------------
export async function createQuote(
  actor: AuthContext,
  orderId: string,
  input: CreateQuoteInput,
): Promise<AdminQuoteView> {
  /*
   * The scope guards a write here, not just a read. Quoting an order advances it
   * to APPROVED, writes its activity feed, and emails the customer — so an
   * unscoped lookup would let a `payments` holder drive the status of a filing
   * assigned to someone else, which is precisely what `orders.updateOrder`
   * refuses to allow.
   */
  const order = await prisma.order.findFirst({
    where: { ...(await orderScope(actor)), id: orderId, deletedAt: null },
    select: {
      id: true,
      reference: true,
      customerId: true,
      customer: { select: { email: true } },
      items: { orderBy: { sortOrder: 'asc' }, select: { serviceName: true } },
    },
  });

  if (!order) throw AppError.notFound('Order not found');

  /*
   * A live offer already stands. Two payable quotes on one order would leave the
   * customer choosing which to pay and us reconciling against the wrong one, so
   * the previous must be settled or withdrawn first. 409: the request is
   * well-formed and the actor is entitled to it, the resource is just in a state
   * that conflicts.
   */
  const outstanding = await prisma.quote.findFirst({
    where: {
      orderId,
      deletedAt: null,
      status: QuoteStatus.PENDING,
      validUntil: { gt: new Date() },
    },
    select: { reference: true },
  });

  if (outstanding) {
    throw AppError.conflict(
      `Quote ${outstanding.reference} is still awaiting payment on this order. Cancel it before sending another.`,
      { reference: outstanding.reference },
    );
  }

  /*
   * The totals. Integer arithmetic only: the subtotal is a sum of the signed
   * line amounts, and the total applies tax and discount as integers. The client
   * sent no total — it never decides an amount (AGENTS.md, Money).
   */
  const subtotal = input.lineItems.reduce((sum, line) => sum + line.amount, 0);
  const total = subtotal + input.tax - input.discount;

  // A quote that asks for nothing (or for a negative amount) is a mistake in the
  // sender's arithmetic, not an offer we should send.
  if (total <= 0) {
    throw AppError.businessRule(
      'A quote total must be greater than zero. Check the line items, tax, and discount.',
      { subtotal, tax: input.tax, discount: input.discount, total },
    );
  }

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setUTCDate(validUntil.getUTCDate() + input.validForDays);

  // Falls back to the order's own services, so the billing row reads correctly
  // without the sender retyping what they are quoting for.
  const serviceName =
    input.serviceName ??
    (order.items.length > 1
      ? `${order.items[0]?.serviceName ?? 'Services'} +${order.items.length - 1}`
      : (order.items[0]?.serviceName ?? `Order ${order.reference}`));

  const actorName = await staffDisplayName(actor.userId);

  /*
   * One transaction: the quote, its lines, and the activity row that tells the
   * customer it arrived. An order can never show a price with no explanation of
   * where it came from, nor a feed entry pointing at a quote that failed to
   * write.
   */
  // Set inside the transaction, read after it commits so the audit entry is only
  // written for a status change that actually landed.
  let advanced: { from: OrderStatus; to: OrderStatus } | null = null;

  const quote = await createWithUniqueReference((reference) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          reference,
          customerId: order.customerId,
          orderId: order.id,
          status: QuoteStatus.PENDING,
          serviceName,
          subtotal,
          discount: input.discount,
          tax: input.tax,
          total,
          currency: input.currency,
          issuedAt: now,
          validUntil,
          lineItems: {
            create: input.lineItems.map((line, index) => ({
              label: line.label,
              amount: line.amount,
              sortOrder: index,
            })),
          },
        },
        include: { lineItems: true },
      });

      const amount = formatMoneyDisplay({ amount: total, currency: input.currency });

      await tx.orderActivity.create({
        data: {
          orderId: order.id,
          author: OrderActivityAuthor.TEAM,
          authorName: actorName,
          authorUserId: actor.userId,
          message: input.message
            ? `Quote ${reference} sent for ${amount}. ${input.message}`
            : `Quote ${reference} sent for ${amount}.`,
          // The price is the customer's own business — always visible.
          internal: false,
        },
      });

      // The in-app feed entry behind the bell, pointing at the quote itself.
      await tx.feedNotification.create({
        data: {
          userId: order.customerId,
          category: FeedNotificationCategory.BILLING,
          message: `You have a new quote (${reference}) for ${amount} on order ${order.reference}.`,
          href: `/app/billing/quotes/${created.id}`,
        },
      });

      /*
       * Sending the price is the approval. An order that has been reviewed and
       * quoted is, by definition, one we have accepted and priced — leaving it in
       * UNDER_REVIEW would ask the reviewer to record the same decision twice, and
       * the one they forget is the one the customer sees. Same transaction as the
       * quote: a priced order that still reads "under review" is exactly the drift
       * this avoids.
       *
       * `advanceOrderStatus` only moves forward, so re-quoting an order already
       * being processed leaves it where it is.
       */
      advanced = await advanceOrderStatus(tx, order.id, OrderStatus.APPROVED, {
        authorName: 'Marty Global',
        message: `Order approved — quote ${reference} sent for ${amount}.`,
      });

      return created;
    }),
  );

  void record({
    actor,
    action: AuditAction.QUOTE_SENT,
    entityType: 'Quote',
    entityId: quote.id,
    // Minor units and a reference — no customer name, no message body.
    metadata: {
      reference: quote.reference,
      orderReference: order.reference,
      total,
      currency: input.currency,
    },
  });

  // The status moved as a consequence of this actor's action, so it is audited
  // against them — the trail has to show who caused it, not just that it happened
  // (AGENTS.md: every state change on billing and orders writes an audit entry).
  if (advanced) {
    const { from, to } = advanced;
    void record({
      actor,
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: 'Order',
      entityId: order.id,
      metadata: { from, to, reference: order.reference, via: 'quote_sent' },
    });
  }

  // The quote is already committed; a failure to queue the email must not undo
  // it or fail the request (the same posture as an order reply).
  await queueQuoteEmail(order, quote, actorName).catch((error) => {
    logger.error(
      {
        orderId: order.id,
        quoteId: quote.id,
        err: error instanceof Error ? error.message : error,
      },
      'Failed to queue quote email',
    );
  });

  logger.info(
    { orderId: order.id, quoteId: quote.id, reference: quote.reference },
    'Quote sent',
  );

  return toQuoteView(quote, now);
}

/*
 * Withdraw a quote that is no longer the offer we want to stand — the escape
 * hatch the "one live quote at a time" rule above needs. A paid quote is history
 * and can never be cancelled — the money has already been collected.
 */
export async function cancelQuote(
  actor: AuthContext,
  orderId: string,
  quoteId: string,
): Promise<AdminQuoteView> {
  // Reached through the order, so the order's scope is what gates it.
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      orderId,
      deletedAt: null,
      order: { is: await orderScope(actor) },
    },
    include: { lineItems: true },
  });

  if (!quote) throw AppError.notFound('Quote not found');

  if (quote.status === QuoteStatus.PAID) {
    throw AppError.businessRule('A paid quote cannot be cancelled.');
  }

  if (quote.status === QuoteStatus.CANCELLED) return toQuoteView(quote);

  const actorName = await staffDisplayName(actor.userId);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.CANCELLED },
      include: { lineItems: true },
    });

    await tx.orderActivity.create({
      data: {
        orderId,
        author: OrderActivityAuthor.TEAM,
        authorName: actorName,
        authorUserId: actor.userId,
        message: `Quote ${quote.reference} was withdrawn.`,
        internal: false,
      },
    });

    return next;
  });

  void record({
    actor,
    action: AuditAction.QUOTE_CANCELLED,
    entityType: 'Quote',
    entityId: quoteId,
    metadata: { reference: quote.reference, from: quote.status },
  });

  return toQuoteView(updated);
}

async function staffDisplayName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  return user?.name ?? 'Marty Global team';
}

async function queueQuoteEmail(
  order: { id: string; reference: string; customerId: string; customer: { email: string } },
  quote: { reference: string; total: number; currency: string; validUntil: Date },
  authorName: string,
): Promise<void> {
  const amount = formatMoneyDisplay({ amount: quote.total, currency: quote.currency });

  await queueEmail({
    to: order.customer.email,
    subject: `Your quote ${quote.reference} for order ${order.reference}`,
    template: 'generic',
    heading: `${authorName} sent you a quote`,
    body: `We've reviewed your application (${order.reference}) and prepared a quote of ${amount}. It's valid until ${quote.validUntil.toISOString().slice(0, 10)}.`,
    actionLabel: 'View quote',
    actionUrl: `${process.env.FRONTEND_ORIGIN ?? ''}/app/orders/${order.id}`,
    userId: order.customerId,
  });
}
