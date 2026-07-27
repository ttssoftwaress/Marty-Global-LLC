import {
  OrderActivityAuthor,
  OrderDocumentSource,
  OrderDocumentStatus,
  OrderStatus,
  Prisma,
  QuoteStatus,
  type Order,
  type OrderItem,
  type Quote,
  type QuoteLineItem,
} from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { assertFound } from '../../guards/ownership.js';
import type { AuthContext } from '../../guards/auth-context.js';
import { AppError } from '../../lib/app-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject } from '../../lib/storage.js';
import { queueEmail } from '../notifications/notifications.service.js';
import { assertKeyForPurpose } from '../uploads/uploads.service.js';
import {
  fieldsByKey,
  getActiveServicesByIds,
  serviceQuestions,
  type CatalogService,
} from '../services/services.service.js';
import type { ServiceField } from '../services/services.validation.js';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderFilter,
  UploadOrderDocumentsInput,
} from './orders.validation.js';

// The orders module owns creating an order (a quote request) and reading a
// customer's orders back. All Prisma access and ownership checks live here; the
// controller is an adapter. An order is created SUBMITTED and unpriced — the team
// prices it later (billing/payments, not built yet).

// --- Status → view mappings ----------------------------------------------
// The frontend renders a lowercase status; Prisma stores the enum uppercase.
const STATUS_TO_VIEW: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: 'draft',
  [OrderStatus.SUBMITTED]: 'submitted',
  [OrderStatus.UNDER_REVIEW]: 'under_review',
  [OrderStatus.MISSING_INFO]: 'missing_info',
  [OrderStatus.APPROVED]: 'approved',
  [OrderStatus.PAID]: 'paid',
  [OrderStatus.PROCESSING]: 'processing',
  [OrderStatus.COMPLETED]: 'completed',
};

// Each filter tab maps to a set of statuses (AGENTS.md: the backend resolves the
// filtering). `active` is anything in flight; `attention` is the one status that
// needs the customer to act; `completed` is terminal.
const FILTER_STATUSES: Record<Exclude<OrderFilter, 'all'>, OrderStatus[]> = {
  active: [
    OrderStatus.SUBMITTED,
    OrderStatus.UNDER_REVIEW,
    OrderStatus.MISSING_INFO,
    OrderStatus.APPROVED,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
  ],
  completed: [OrderStatus.COMPLETED],
  attention: [OrderStatus.MISSING_INFO],
};

// The order-detail timeline is a fixed five-stage lifecycle; an order's status
// picks the current stage. `missing_info` sits back at review (the customer has
// to resolve something before it can advance).
const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'review', label: 'Under review' },
  { key: 'quote', label: 'Quote & payment' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
] as const;

/*
 * APPROVED and PAID both sit on the quote-and-payment stage: an approved order
 * is one the customer has been asked to pay, a paid one has settled but has not
 * been picked up yet. PROCESSING is the stage that had no status behind it —
 * the timeline drew it, and nothing could ever light it up.
 */
const STATUS_TIMELINE_INDEX: Record<OrderStatus, number> = {
  [OrderStatus.DRAFT]: 0,
  [OrderStatus.SUBMITTED]: 0,
  [OrderStatus.UNDER_REVIEW]: 1,
  [OrderStatus.MISSING_INFO]: 1,
  [OrderStatus.APPROVED]: 2,
  [OrderStatus.PAID]: 2,
  [OrderStatus.PROCESSING]: 3,
  [OrderStatus.COMPLETED]: 4,
};

// --- Reference generation ------------------------------------------------
// A human-facing "ORD-#####". Distinct from the cuid id. Random rather than a
// count (a count race could collide); the unique constraint is the real guard,
// and we retry on the rare collision.
function makeReference(): string {
  const n = 10_000 + Math.floor(Math.random() * 90_000);
  return `ORD-${n}`;
}

// --- Answer validation ---------------------------------------------------
// Validate a customer's answers for one service against that service's own
// field schema: every required field must be a non-empty string. Returns the
// snapshot of known answers (unknown keys are dropped so a client can't stuff
// arbitrary data into the order record).
function resolveAnswers(
  service: CatalogService,
  raw: Record<string, string> | undefined,
): Record<string, string> {
  const answers: Record<string, string> = {};
  const provided = raw ?? {};

  // Every question the service asks, stepped or flat — validating against the
  // flat list alone would skip a required question on a service whose form the
  // admin has split into steps.
  for (const field of serviceQuestions(service)) {
    const value = (provided[field.name] ?? '').trim();

    if (field.required && value.length === 0) {
      throw AppError.validation(
        `Missing required field "${field.label}" for ${service.name}`,
        { serviceId: service.id, field: field.name },
      );
    }

    // A select's value must be one of its options — a free-form value would be a
    // tampered request, since the UI only offers the listed options.
    if (field.type === 'select' && value.length > 0) {
      const allowed = field.options.some((option) => option.value === value);
      if (!allowed) {
        throw AppError.validation(
          `Invalid value for "${field.label}" on ${service.name}`,
          { serviceId: service.id, field: field.name },
        );
      }
    }

    if (value.length > 0) answers[field.name] = value;
  }

  return answers;
}

// --- Region denormalization ----------------------------------------------
/*
 * `Order.regionCode` is the jurisdiction the admin queue filters and groups on.
 * It is denormalised from the application's own answers at creation, because a
 * Json probe into `OrderItem.answers` could neither be indexed nor kept honest
 * as field names change per service (schema.prisma says as much).
 *
 * The catalog asks for the jurisdiction under a few different field names and in
 * its own slugs ("us-de", "uk"), while `Region.code` is ISO 3166-1 alpha-2 with
 * a couple of non-country codes. This is the one place the two vocabularies
 * meet: a field whose name reads as a jurisdiction, its value reduced to the
 * part before the state suffix, then mapped through the aliases below.
 *
 * An unrecognised value leaves the column null rather than guessing — the queue
 * renders that as "Not specified", which is honest, where a wrong region would
 * quietly file the order under the wrong desk.
 */
const REGION_FIELD_PATTERN = /region|jurisdiction|country/i;

const REGION_ALIASES: Record<string, string> = {
  us: 'US',
  uk: 'GB',
  gb: 'GB',
  ca: 'CA',
  eu: 'EU',
  uae: 'AE',
  ae: 'AE',
  sg: 'SG',
  au: 'AU',
};

function candidateRegionCodes(
  items: { answers: Record<string, string> }[],
): string[] {
  const codes: string[] = [];

  for (const item of items) {
    for (const [name, value] of Object.entries(item.answers)) {
      if (!REGION_FIELD_PATTERN.test(name)) continue;

      // "us-de" is Delaware within the United States; the region is the country.
      const root = value.split('-')[0]?.toLowerCase() ?? '';
      const code = REGION_ALIASES[root] ?? root.toUpperCase();
      if (code) codes.push(code);
    }
  }

  return codes;
}

// The first candidate that is a real active region wins — items are already in
// the order the customer picked them, so the primary service decides.
async function resolveRegionCode(
  items: { answers: Record<string, string> }[],
): Promise<string | null> {
  const codes = candidateRegionCodes(items);
  if (codes.length === 0) return null;

  const regions = await prisma.region.findMany({
    where: { code: { in: [...new Set(codes)] }, active: true },
    select: { code: true },
  });

  const known = new Set(regions.map((region) => region.code));
  return codes.find((code) => known.has(code)) ?? null;
}

// --- Create --------------------------------------------------------------
// The shape Step 3 (Application submitted) renders — returned by createOrder.
export type OrderConfirmation = {
  reference: string;
  submittedAt: string;
  serviceNames: string[];
  confirmationEmail: string;
};

export async function createOrder(
  req: Parameters<typeof getAuth>[0],
  input: CreateOrderInput,
): Promise<OrderConfirmation> {
  const auth = getAuth(req);

  // Resolve the selection against the live catalog. A service id that isn't an
  // active service is a stale or tampered selection — reject rather than create a
  // dangling order. De-dupe ids so a repeated selection is one item.
  const uniqueIds = [...new Set(input.serviceIds)];
  const catalog = await getActiveServicesByIds(uniqueIds);

  const missing = uniqueIds.filter((id) => !catalog.has(id));
  if (missing.length > 0) {
    throw AppError.validation('One or more selected services are unavailable', {
      serviceIds: missing,
    });
  }

  /*
   * Every attached key must be one this customer's own uploads minted. The keys
   * are unguessable, so this is a second line of defence — it stops a key held
   * back from another context, or another customer's key, being attached to an
   * order as though we had received that file.
   */
  const documents = input.documents ?? [];

  for (const document of documents) {
    assertKeyForPurpose(auth, 'order-document', document.objectKey);
  }

  // Build the items in the order the customer selected, validating each service's
  // answers against its own field schema.
  const items = uniqueIds.map((id, index) => {
    const svc = catalog.get(id)!;
    return {
      serviceId: svc.id,
      serviceName: svc.name,
      answers: resolveAnswers(svc, input.answersByService[id]),
      sortOrder: index,
    };
  });

  const now = new Date();

  const [regionCode, customer] = await Promise.all([
    resolveRegionCode(items),
    prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
  ]);

  // Create the order with a unique reference, retrying on the rare collision.
  const order = await createWithUniqueReference((reference) =>
    prisma.order.create({
      data: {
        reference,
        customerId: auth.userId,
        status: OrderStatus.SUBMITTED,
        submittedAt: now,
        notes: input.notes,
        regionCode,
        items: {
          create: items.map((item) => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            answers: item.answers,
            sortOrder: item.sortOrder,
          })),
        },
        // The feed opens on the submission itself, so a reviewer landing on the
        // order sees when it arrived and the customer's own detail page is never
        // an empty Activity card. Written in the same statement as the order, so
        // an order can never exist without the entry that starts its history.
        activity: {
          create: {
            author: OrderActivityAuthor.CUSTOMER,
            authorName: customer?.name ?? 'Customer',
            authorUserId: auth.userId,
            message: `Application submitted with ${items.length} ${
              items.length === 1 ? 'service' : 'services'
            }.`,
            occurredAt: now,
          },
        },
        /*
         * The files the customer attached during the wizard. Created in the same
         * statement as the order: an application whose documents landed but whose
         * order did not would leave orphaned objects nobody can reach.
         *
         * AVAILABLE, not PENDING — the object already exists (the browser PUT it
         * to R2 before submitting). PENDING is for a document we have asked for
         * and not yet received.
         */
        documents: {
          create: documents.map((document) => ({
            name: document.name,
            objectKey: document.objectKey,
            contentType: document.contentType,
            sizeBytes: document.sizeBytes ?? null,
            status: OrderDocumentStatus.AVAILABLE,
            source: OrderDocumentSource.CUSTOMER,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    }),
  );

  logger.info(
    { orderId: order.id, reference: order.reference, customerId: auth.userId },
    'Order created',
  );

  const serviceNames = order.items.map((item) => item.serviceName);

  // Queue the confirmation email through the notifications pipeline (never inline,
  // AGENTS.md). A failure here must not fail the order — the order is already
  // committed — so log and continue; the customer still sees the confirmation.
  await sendOrderConfirmation(auth, order.reference, serviceNames).catch((error) => {
    logger.error(
      { orderId: order.id, err: error instanceof Error ? error.message : error },
      'Failed to queue order confirmation email',
    );
  });

  return {
    reference: order.reference,
    submittedAt: (order.submittedAt ?? order.createdAt).toISOString(),
    serviceNames,
    confirmationEmail: auth.email,
  };
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
  throw AppError.conflict('Could not allocate a unique order reference');
}

async function sendOrderConfirmation(
  auth: AuthContext,
  reference: string,
  serviceNames: string[],
): Promise<void> {
  const list =
    serviceNames.length === 1
      ? serviceNames[0]
      : `${serviceNames.slice(0, -1).join(', ')} and ${serviceNames.at(-1)}`;

  await queueEmail({
    to: auth.email,
    subject: `We received your order ${reference}`,
    template: 'generic',
    heading: 'Application submitted',
    body: `Thanks — we've received your application (${reference}) for ${list}. Our team will review your details and send a personalized quote with a secure payment link within 1–2 business days.`,
    actionLabel: 'View in My Orders',
    actionUrl: `${process.env.FRONTEND_ORIGIN ?? ''}/app/orders`,
    userId: auth.userId,
  });
}

// --- Automatic pipeline advances -----------------------------------------
/*
 * Two stages of the pipeline are reached by something happening rather than by
 * someone clicking: sending a quote approves the order, and a settled payment
 * marks it paid. Both call this.
 *
 * It only ever moves an order *forward*. The rank below is the pipeline's own
 * order, and a target at or behind the current stage is a no-op — a second
 * quote on an order already in PROCESSING must not drag it back to APPROVED,
 * and a payment that settles after a reviewer already advanced the filing by
 * hand must not undo their work. MISSING_INFO ranks alongside UNDER_REVIEW
 * because it is that same stage with the ball in the customer's court, so
 * quoting an order parked on a missing document still approves it.
 *
 * Takes a transaction client: every caller is already inside one, and the status
 * change must commit with the quote or the payment that caused it — an order
 * showing "Paid" against a payment row that rolled back is the one outcome worth
 * designing against.
 *
 * The activity row is the customer-visible explanation, written here so the two
 * facts can never disagree. Returns the status actually set, or null when the
 * order was already at or past the target, so the caller knows whether to audit.
 */
const STATUS_RANK: Record<OrderStatus, number> = {
  [OrderStatus.DRAFT]: 0,
  [OrderStatus.SUBMITTED]: 1,
  [OrderStatus.UNDER_REVIEW]: 2,
  [OrderStatus.MISSING_INFO]: 2,
  [OrderStatus.APPROVED]: 3,
  [OrderStatus.PAID]: 4,
  [OrderStatus.PROCESSING]: 5,
  [OrderStatus.COMPLETED]: 6,
};

export async function advanceOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  target: OrderStatus,
  activity: { authorName: string; authorUserId?: string; message: string },
): Promise<{ from: OrderStatus; to: OrderStatus } | null> {
  const order = await tx.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!order) return null;
  if (STATUS_RANK[order.status] >= STATUS_RANK[target]) return null;

  await tx.order.update({ where: { id: orderId }, data: { status: target } });

  await tx.orderActivity.create({
    data: {
      orderId,
      // SYSTEM, not TEAM: no person chose this, and signing it with the staff
      // member who sent the quote would read as them having moved it by hand.
      author: OrderActivityAuthor.SYSTEM,
      authorName: activity.authorName,
      ...(activity.authorUserId ? { authorUserId: activity.authorUserId } : {}),
      message: activity.message,
      internal: false,
    },
  });

  return { from: order.status, to: target };
}

// --- List ----------------------------------------------------------------
export type OrderListItem = {
  id: string;
  reference: string;
  serviceName: string;
  submittedAt: string;
  status: string;
};

export type OrdersPage = {
  orders: OrderListItem[];
  counts: Record<OrderFilter, number>;
  page: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
};

// The list line shows one service name per order; an order can hold several, so
// summarize as "First service +N" when there are more.
function summarizeServiceName(items: Pick<OrderItem, 'serviceName' | 'sortOrder'>[]): string {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const first = sorted[0];
  if (!first) return 'Order';
  const extra = sorted.length - 1;
  return extra > 0 ? `${first.serviceName} +${extra}` : first.serviceName;
}

export async function listOrders(
  req: Parameters<typeof getAuth>[0],
  query: ListOrdersQuery,
): Promise<OrdersPage> {
  const auth = getAuth(req);

  // A customer sees only their own orders; the ownership boundary is this where
  // clause, not a per-row check (AGENTS.md: guards are the real boundary).
  const scope: Prisma.OrderWhereInput = {
    customerId: auth.userId,
    deletedAt: null,
  };

  const search = query.search;
  const searchWhere: Prisma.OrderWhereInput = search
    ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { items: { some: { serviceName: { contains: search, mode: 'insensitive' } } } },
        ],
      }
    : {};

  const filterWhere: Prisma.OrderWhereInput =
    query.filter === 'all' ? {} : { status: { in: FILTER_STATUSES[query.filter] } };

  const where: Prisma.OrderWhereInput = { ...scope, ...searchWhere, ...filterWhere };

  // Counts for every filter tab, over the same search scope, so the badges stay
  // correct as the customer narrows the list.
  const countsScope: Prisma.OrderWhereInput = { ...scope, ...searchWhere };
  const [totalCount, activeCount, completedCount, attentionCount] = await Promise.all([
    prisma.order.count({ where: countsScope }),
    prisma.order.count({ where: { ...countsScope, status: { in: FILTER_STATUSES.active } } }),
    prisma.order.count({ where: { ...countsScope, status: { in: FILTER_STATUSES.completed } } }),
    prisma.order.count({ where: { ...countsScope, status: { in: FILTER_STATUSES.attention } } }),
  ]);

  const filteredCount = await prisma.order.count({ where });

  // Cursor pagination (AGENTS.md): fetch limit+1 to know whether more remain.
  const rows = await prisma.order.findMany({
    where,
    include: { items: { select: { serviceName: true, sortOrder: true } } },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? pageRows.at(-1)?.id ?? null : null;

  const orders: OrderListItem[] = pageRows.map((order) => ({
    id: order.id,
    reference: order.reference,
    serviceName: summarizeServiceName(order.items),
    submittedAt: (order.submittedAt ?? order.createdAt).toISOString(),
    status: STATUS_TO_VIEW[order.status],
  }));

  const totalPages = Math.max(1, Math.ceil(filteredCount / query.limit));

  return {
    orders,
    counts: {
      all: totalCount,
      active: activeCount,
      completed: completedCount,
      attention: attentionCount,
    },
    // The design's "Page X of Y" is a convenience over the cursor stream; without
    // an offset we report page 1 for the first fetch and let the cursor advance.
    page: query.cursor ? 0 : 1,
    totalPages,
    totalCount: filteredCount,
    hasMore,
    nextCursor,
  };
}

// --- Detail --------------------------------------------------------------
// The order-detail shapes the screen renders. The priced summary and payment
// come from billing/payments (not built yet), so they're returned empty/pending
// — the UI already renders those empty states.
type OrderDetailField = { label: string; value: string };

/*
 * One entry in the customer's feed. `author` is only ever `team` or `customer`
 * on this wire: a SYSTEM row is the business writing to the customer just as a
 * TEAM row is, and the portal draws both with the Marty Global monogram, so the
 * distinction would be a difference the screen cannot express.
 *
 * Internal notes never appear here — they are filtered in the query below, not
 * in the mapper, so a future caller cannot forget the filter.
 */
export type OrderActivityView = {
  id: string;
  author: 'team' | 'customer';
  authorName: string;
  occurredAt: string;
  message: string;
};

type Money = { amount: number; currency: string };

/*
 * The quote the team sent on this order, as the customer's own screen renders
 * it. Null until one is raised, which is what keeps the summary card in its
 * "awaiting quote" state rather than showing a fabricated price.
 *
 * MONEY: integer minor units + ISO 4217 throughout, passed through untouched —
 * the browser formats at render (AGENTS.md, Money).
 */
export type OrderQuoteView = {
  id: string;
  reference: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  serviceName: string;
  lineItems: { label: string; amount: Money }[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  issuedAt: string;
  validUntil: string;
  paidAt: string | null;
  // Whether this offer can still be paid — false once it is paid, withdrawn, or
  // past its window. The backend decides it so the Pay button and the payment
  // endpoint agree.
  payable: boolean;
};

export type OrderDetail = {
  id: string;
  reference: string;
  serviceName: string;
  status: string;
  submittedAt: string;
  timeline: {
    steps: { key: string; label: string; date?: string }[];
    currentIndex: number;
  };
  applicationDetails: OrderDetailField[];
  documents: { id: string; name: string; available: boolean }[];
  activity: OrderActivityView[];
  quote: OrderQuoteView | null;
  summary: {
    lineItems: { label: string; amount: Money }[];
    subtotal: Money;
    discount?: Money;
    total: Money;
  };
  payment: { state: 'paid' | 'pending'; fields: OrderDetailField[] };
  orderInformation: OrderDetailField[];
};

type OrderWithItems = Order & {
  items: (OrderItem & { service: { name: string } | null })[];
};

/*
 * One order item's stored answers as labelled rows.
 *
 * Labels come from the FIELD REGISTRY, not from a schema copied onto the service:
 * `OrderItem.answers` is keyed by `FieldDefinition.key`, so `registry` is the
 * resolved definitions for the keys in play. A key the registry no longer knows
 * falls back to printing the raw key, which is honest rather than blank.
 *
 * Exported because the admin order-detail screen prints the same answers grouped
 * per service. An order's answers must read identically on both sides of the
 * desk — a customer quoting a value back to support and the reviewer looking at
 * it have to be seeing the same words.
 */
export function itemAnswerFields(
  item: Pick<OrderItem, 'answers'>,
  registry: Map<string, ServiceField>,
): OrderDetailField[] {
  const answers = (item.answers ?? {}) as Record<string, string>;

  return Object.entries(answers).map(([name, value]) => {
    const field = registry.get(name);

    // A stored select value ("us-de") renders as its option label ("United
    // States — Delaware"); anything else prints as given.
    const label =
      field?.type === 'select'
        ? (field.options.find((option) => option.value === value)?.label ?? value)
        : value;

    return { label: field?.label ?? name, value: label };
  });
}

// Every answer key an order holds — what the registry lookup is run against.
export function orderAnswerKeys(
  items: Pick<OrderItem, 'answers'>[],
): string[] {
  return items.flatMap((item) =>
    Object.keys((item.answers ?? {}) as Record<string, string>),
  );
}

// The customer's detail card prints every service's answers as one flat list.
function applicationFields(
  order: OrderWithItems,
  registry: Map<string, ServiceField>,
): OrderDetailField[] {
  return [...order.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((item) => itemAnswerFields(item, registry));
}

/*
 * The order's quote as the customer's screen renders it. A PENDING quote past
 * its window reads as expired on this render rather than waiting for a job to
 * flip the row — the same rule the billing screen applies, so a customer never
 * sees one screen offer to take payment for something another calls expired.
 */
function toQuoteView(
  quote: Quote & { lineItems: QuoteLineItem[] },
  now: Date,
): OrderQuoteView {
  const expired = quote.status === QuoteStatus.PENDING && quote.validUntil <= now;

  const status: OrderQuoteView['status'] = expired
    ? 'expired'
    : quote.status === QuoteStatus.PAID
      ? 'paid'
      : quote.status === QuoteStatus.CANCELLED
        ? 'cancelled'
        : quote.status === QuoteStatus.EXPIRED
          ? 'expired'
          : 'pending';

  const currency = quote.currency;

  return {
    id: quote.id,
    reference: quote.reference,
    status,
    serviceName: quote.serviceName,
    lineItems: quote.lineItems.map((line) => ({
      label: line.label,
      amount: { amount: line.amount, currency },
    })),
    subtotal: { amount: quote.subtotal, currency },
    discount: { amount: quote.discount, currency },
    tax: { amount: quote.tax, currency },
    total: { amount: quote.total, currency },
    issuedAt: quote.issuedAt.toISOString(),
    validUntil: quote.validUntil.toISOString(),
    paidAt: quote.paidAt?.toISOString() ?? null,
    payable: status === 'pending',
  };
}

// What the payment card prints for each state of the offer. The words live here
// rather than in the browser so a wording change is one deploy, not two.
function paymentFields(quote: OrderQuoteView | null): OrderDetailField[] {
  if (!quote) return [{ label: 'Status', value: 'Awaiting quote' }];

  switch (quote.status) {
    case 'paid':
      return [
        { label: 'Status', value: 'Paid' },
        { label: 'Quote', value: quote.reference },
      ];
    case 'expired':
      return [
        { label: 'Status', value: 'Quote expired' },
        { label: 'Quote', value: quote.reference },
      ];
    case 'cancelled':
      return [
        { label: 'Status', value: 'Quote withdrawn' },
        { label: 'Quote', value: quote.reference },
      ];
    default:
      return [
        { label: 'Status', value: 'Awaiting payment' },
        { label: 'Quote', value: quote.reference },
      ];
  }
}

export async function getOrderDetail(
  req: Parameters<typeof getAuth>[0],
  orderId: string,
): Promise<OrderDetail> {
  const auth = getAuth(req);

  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    include: {
      items: {
        include: { service: { select: { name: true } } },
      },
      // Internal notes are excluded here rather than after the fact: the rows the
      // customer may not see never enter this process's memory.
      activity: { where: { internal: false }, orderBy: { occurredAt: 'asc' } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      /*
       * The newest quote is the offer that stands. A cancelled or expired one
       * still travels rather than being filtered out — the customer who was sent
       * a price is entitled to see what happened to it, and the card renders the
       * status rather than silently emptying.
       */
      quotes: {
        where: { deletedAt: null },
        include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  // 404 (not 403) for another customer's order, so the id isn't confirmed.
  const found = assertFound(order, auth, (o) => o.customerId);

  // Answer labels come from the field registry, loaded once for every key this
  // order holds rather than per item.
  const registry = await fieldsByKey(orderAnswerKeys(found.items));

  const currentIndex = STATUS_TIMELINE_INDEX[found.status];
  const submittedAt = (found.submittedAt ?? found.createdAt).toISOString();

  const latestQuote = found.quotes[0];
  const quote = latestQuote ? toQuoteView(latestQuote, new Date()) : null;

  const steps = TIMELINE_STEPS.map((step, index) => ({
    key: step.key,
    label: step.label,
    // Submission and the quote are the two stages with a real timestamp behind
    // them; the rest show their label without a date until processing
    // timestamps exist.
    date:
      index === 0
        ? submittedAt
        : step.key === 'quote' && quote
          ? quote.issuedAt
          : undefined,
  }));

  const serviceName = summarizeServiceName(
    found.items.map((item) => ({ serviceName: item.serviceName, sortOrder: item.sortOrder })),
  );

  return {
    id: found.id,
    reference: found.reference,
    serviceName,
    status: STATUS_TO_VIEW[found.status],
    submittedAt,
    timeline: { steps, currentIndex },
    applicationDetails: applicationFields(found, registry),
    // `available` gates the download. Only an AVAILABLE row has an object behind
    // it; a PENDING placeholder is a document we owe them, and a REJECTED one is
    // not theirs to fetch. The presigned URL itself is issued by the documents
    // feature (R2 not wired yet), never handed out here.
    documents: found.documents.map((document) => ({
      id: document.id,
      name: document.name,
      available: document.status === OrderDocumentStatus.AVAILABLE,
    })),
    activity: found.activity.map((entry) => ({
      id: entry.id,
      author: entry.author === OrderActivityAuthor.CUSTOMER ? 'customer' : 'team',
      authorName: entry.authorName,
      occurredAt: entry.occurredAt.toISOString(),
      message: entry.message,
    })),
    quote,
    /*
     * The summary mirrors the quote once one exists; until then it stays a zero
     * USD summary the UI renders as "pending" rather than a fabricated price.
     * Kept alongside `quote` because the summary card is a fixed shape the
     * screen already renders, while the quote carries the reference, window, and
     * payability that card has no room for.
     */
    summary: quote
      ? {
          lineItems: quote.lineItems,
          subtotal: quote.subtotal,
          ...(quote.discount.amount > 0 ? { discount: quote.discount } : {}),
          total: quote.total,
        }
      : {
          lineItems: [],
          subtotal: { amount: 0, currency: 'USD' },
          total: { amount: 0, currency: 'USD' },
        },
    payment: {
      state: quote?.status === 'paid' ? 'paid' : 'pending',
      fields: paymentFields(quote),
    },
    orderInformation: [
      { label: 'Order reference', value: found.reference },
      { label: 'Services', value: `${found.items.length}` },
      ...(found.notes ? [{ label: 'Notes', value: found.notes }] : []),
    ],
  };
}

// --- Order documents -----------------------------------------------------
/*
 * Files on an order that already exists — the order-detail screen's dropzone,
 * and the download link beside each row.
 *
 * The upload itself went straight to R2 (`POST /v1/uploads`); what these two do
 * is attach a key to the order and, later, mint a short-TTL link back. Both
 * check ownership through the order, so a document is only ever reachable by the
 * customer whose order it hangs off (AGENTS.md, Security & PII).
 */

async function assertOrderOwned(
  auth: AuthContext,
  orderId: string,
): Promise<string> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: { id: true, customerId: true },
  });

  // 404 (not 403) for another customer's order, so the id isn't confirmed.
  return assertFound(order, auth, (o) => o.customerId).id;
}

export type OrderDocumentView = {
  id: string;
  name: string;
  available: boolean;
};

export async function attachDocuments(
  req: Parameters<typeof getAuth>[0],
  orderId: string,
  input: UploadOrderDocumentsInput,
): Promise<{ documents: OrderDocumentView[] }> {
  const auth = getAuth(req);
  const ownedOrderId = await assertOrderOwned(auth, orderId);

  // The same second line of defence as order creation: a key must be one this
  // customer's own uploads minted.
  for (const document of input.documents) {
    assertKeyForPurpose(auth, 'order-document', document.objectKey);
  }

  const customer = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  /*
   * The rows and the activity entry are written together: a document the team
   * cannot see arrived is a document the customer will be asked for again.
   */
  await prisma.$transaction(async (tx) => {
    await tx.orderDocument.createMany({
      data: input.documents.map((document) => ({
        orderId: ownedOrderId,
        name: document.name,
        objectKey: document.objectKey,
        contentType: document.contentType,
        sizeBytes: document.sizeBytes ?? null,
        status: OrderDocumentStatus.AVAILABLE,
        source: OrderDocumentSource.CUSTOMER,
      })),
    });

    await tx.orderActivity.create({
      data: {
        orderId: ownedOrderId,
        author: OrderActivityAuthor.CUSTOMER,
        authorName: customer?.name ?? 'Customer',
        authorUserId: auth.userId,
        message: `Uploaded ${input.documents.length} ${
          input.documents.length === 1 ? 'document' : 'documents'
        }.`,
      },
    });
  });

  const documents = await prisma.orderDocument.findMany({
    where: { orderId: ownedOrderId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  return {
    documents: documents.map((document) => ({
      id: document.id,
      name: document.name,
      available: document.status === OrderDocumentStatus.AVAILABLE,
    })),
  };
}

/*
 * A short-TTL link to one document, minted per request after the ownership check
 * — never stored, and never handed out with the list (AGENTS.md, Security & PII).
 */
export async function getDocumentLink(
  req: Parameters<typeof getAuth>[0],
  orderId: string,
  documentId: string,
): Promise<{ name: string; url: string }> {
  const auth = getAuth(req);
  const ownedOrderId = await assertOrderOwned(auth, orderId);

  const document = await prisma.orderDocument.findFirst({
    where: { id: documentId, orderId: ownedOrderId, deletedAt: null },
  });

  if (!document) throw AppError.notFound('Document not found');

  // A PENDING placeholder is a document we owe them and a REJECTED one is not
  // theirs to fetch; neither has an object to sign.
  if (document.status !== OrderDocumentStatus.AVAILABLE || !document.objectKey) {
    throw AppError.businessRule('That document is not available yet');
  }

  const url = await presignObject(document.objectKey);

  if (!url) {
    throw AppError.businessRule('That document cannot be downloaded right now');
  }

  return { name: document.name, url };
}
