import { OrderStatus, Prisma, type Order, type OrderItem } from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { assertFound } from '../../guards/ownership.js';
import type { AuthContext } from '../../guards/auth-context.js';
import { AppError } from '../../lib/app-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { queueEmail } from '../notifications/notifications.service.js';
import {
  getActiveServicesByIds,
  type CatalogService,
} from '../services/services.service.js';
import type { ServiceField } from '../services/services.validation.js';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderFilter,
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

const STATUS_TIMELINE_INDEX: Record<OrderStatus, number> = {
  [OrderStatus.DRAFT]: 0,
  [OrderStatus.SUBMITTED]: 0,
  [OrderStatus.UNDER_REVIEW]: 1,
  [OrderStatus.MISSING_INFO]: 1,
  [OrderStatus.APPROVED]: 2,
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

  for (const field of service.detailFields) {
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

  // Create the order with a unique reference, retrying on the rare collision.
  const order = await createWithUniqueReference((reference) =>
    prisma.order.create({
      data: {
        reference,
        customerId: auth.userId,
        status: OrderStatus.SUBMITTED,
        submittedAt: now,
        notes: input.notes,
        items: {
          create: items.map((item) => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            answers: item.answers,
            sortOrder: item.sortOrder,
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
// The order-detail shapes the screen renders. Priced summary, payment, and the
// activity feed come from billing/payments (not built yet), so they're returned
// empty/pending — the UI already renders those empty states.
type OrderDetailField = { label: string; value: string };

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
  activity: never[];
  summary: {
    lineItems: never[];
    subtotal: { amount: number; currency: string };
    total: { amount: number; currency: string };
  };
  payment: { state: 'pending'; fields: OrderDetailField[] };
  orderInformation: OrderDetailField[];
};

type OrderWithItems = Order & {
  items: (OrderItem & { service: { detailFields: unknown; name: string } | null })[];
};

// Turn an item's stored answers into labelled rows, using the service's field
// schema for human labels (falling back to the raw key if the field is gone).
function applicationFields(order: OrderWithItems): OrderDetailField[] {
  const fields: OrderDetailField[] = [];

  for (const item of [...order.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const schema = parseFieldSchema(item.service?.detailFields);
    const labels = new Map(schema.map((f) => [f.name, f.label] as const));
    const optionLabels = optionLabelIndex(schema);
    const answers = (item.answers ?? {}) as Record<string, string>;

    for (const [name, value] of Object.entries(answers)) {
      fields.push({
        label: labels.get(name) ?? name,
        value: optionLabels.get(`${name}:${value}`) ?? value,
      });
    }
  }

  return fields;
}

function parseFieldSchema(raw: unknown): ServiceField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is ServiceField =>
      typeof f === 'object' && f !== null && 'name' in f && 'label' in f && 'type' in f,
  );
}

// Map "fieldName:value" → the option's human label, so a stored select value
// ("us-de") renders as its label ("United States — Delaware").
function optionLabelIndex(schema: ServiceField[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const field of schema) {
    if (field.type === 'select') {
      for (const option of field.options) {
        index.set(`${field.name}:${option.value}`, option.label);
      }
    }
  }
  return index;
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
        include: { service: { select: { detailFields: true, name: true } } },
      },
    },
  });

  // 404 (not 403) for another customer's order, so the id isn't confirmed.
  const found = assertFound(order, auth, (o) => o.customerId);

  const currentIndex = STATUS_TIMELINE_INDEX[found.status];
  const submittedAt = (found.submittedAt ?? found.createdAt).toISOString();

  const steps = TIMELINE_STEPS.map((step, index) => ({
    key: step.key,
    label: step.label,
    // Only the submitted step has a real date so far; later stages show their
    // label without a date until billing/processing timestamps exist.
    date: index === 0 ? submittedAt : undefined,
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
    applicationDetails: applicationFields(found),
    // Documents belong to the R2 upload feature (deferred) — none yet.
    documents: [],
    activity: [],
    // Unpriced until the team quotes it — a zero USD summary the UI renders as
    // "pending" rather than a fabricated price.
    summary: {
      lineItems: [],
      subtotal: { amount: 0, currency: 'USD' },
      total: { amount: 0, currency: 'USD' },
    },
    payment: {
      state: 'pending',
      fields: [{ label: 'Status', value: 'Awaiting quote' }],
    },
    orderInformation: [
      { label: 'Order reference', value: found.reference },
      { label: 'Services', value: `${found.items.length}` },
      ...(found.notes ? [{ label: 'Notes', value: found.notes }] : []),
    ],
  };
}
