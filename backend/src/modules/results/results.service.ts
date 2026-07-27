import {
  Prisma,
  ServiceRequestStatus,
  ServiceResultStatus,
  type ResultFieldDefinition,
  type Service,
  type ServiceRequest,
  type ServiceResult,
  type ServiceResultValue,
} from '@prisma/client';

import type { AuthContext } from '../../guards/auth-context.js';
import { AppError } from '../../lib/app-error.js';
import { cursorArgs, takePage } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject } from '../../lib/storage.js';
import { iso, isoOrNull } from '../admin/admin.views.js';
import { fieldsByKey } from '../services/services.service.js';
import { fieldRefsSchema } from '../services/services.validation.js';
import {
  listFields,
  loadResultRegistry,
  primaryField,
  resolveResultRefs,
  storedResultRefs,
} from './results.fields.js';
import { toValueView, type ResultValueView } from './results.values.js';
import type {
  CreateServiceRequestInput,
  ListRequestsQuery,
  ListResultsQuery,
  ResultField,
} from './results.validation.js';

/*
 * The customer's side of service delivery: the per-service pages listing what
 * they own, one record's detail, and raising a follow-up request.
 *
 * All Prisma access for `ServiceResult`, `ServiceResultValue`, and the customer
 * half of `ServiceRequest` lives here (AGENTS.md: services own all logic and all
 * Prisma access). Every read is scoped to the signed-in customer — ownership is
 * checked in this layer, after the record is loaded, never by trusting a path id.
 *
 * DRAFT records are invisible here without exception. A record is a draft while
 * staff are still filling it in, and the whole point of the state is that the
 * customer is not shown a half-written filing.
 */

const CUSTOMER_VISIBLE: ServiceResultStatus[] = [
  ServiceResultStatus.ACTIVE,
  ServiceResultStatus.ARCHIVED,
];

/*
 * Records whose service marks its result form as internal are excluded from
 * every customer-facing read on this module.
 *
 * The virtual mail room is the case: staff fill in a result form to record the
 * address the room opens at, but what the customer receives is the mail room at
 * `/app/mailroom`, not a second record page for the same subscription. Spread
 * into each `where` beside the status filter, so a new read cannot forget it —
 * the two clauses are always written together.
 */
const CUSTOMER_FACING = {
  status: { in: CUSTOMER_VISIBLE },
  service: { is: { resultInternal: false } },
} satisfies Prisma.ServiceResultWhereInput;

// --- View shapes ----------------------------------------------------------

// One service the customer owns records for — a sidebar entry and the header of
// its page.
export type CustomerServiceSummary = {
  serviceId: string;
  slug: string;
  name: string;
  // "My companies" — the page's own heading. See Service.resultPageTitle.
  pageTitle: string;
  noun: string;
  iconKey: string;
  count: number;
};

export type ServiceResultRow = {
  id: string;
  reference: string;
  title: string;
  status: 'active' | 'archived';
  orderId: string;
  orderReference: string;
  deliveredAt: string | null;
  updatedAt: string;
  // Keyed by field name, for the columns `listFields` names. The row renders
  // whatever the service's schema says, so the table is entirely data-driven.
  values: Record<string, ResultValueView>;
  openRequests: number;
};

export type ServiceResultListView = {
  service: CustomerServiceSummary;
  // The columns this service's table prints, in order. The frontend renders
  // these — it never hardcodes a column set.
  columns: ResultField[];
  rows: ServiceResultRow[];
  nextCursor: string | null;
  totalResults: number;
};

export type ServiceRequestView = {
  id: string;
  reference: string;
  typeLabel: string;
  status: 'submitted' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  note: string | null;
  blockedReason: string | null;
  resolution: string | null;
  assigneeName: string | null;
  createdAt: string;
  closedAt: string | null;
};

export type RequestTypeView = {
  id: string;
  key: string;
  label: string;
  description?: string;
  iconKey?: string;
  turnaround?: string;
  // The intake form, resolved from the REQUEST registry. Empty means the button
  // raises the request immediately.
  fields: Awaited<ReturnType<typeof fieldsByKey>> extends Map<string, infer F>
    ? F[]
    : never;
};

export type ServiceResultDetailView = {
  id: string;
  reference: string;
  title: string;
  status: 'active' | 'archived';
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  pageTitle: string;
  orderId: string;
  orderReference: string;
  deliveredAt: string | null;
  lastEditedAt: string | null;
  // The full schema, grouped by the admin's `category` so the detail page renders
  // cards rather than one flat list.
  sections: { title: string; fields: ResultField[] }[];
  values: Record<string, ResultValueView>;
  // Presigned download links for file values, keyed by field. Minted per request
  // with a short TTL after the ownership check above (AGENTS.md).
  downloads: Record<string, string>;
  requestTypes: RequestTypeView[];
  requests: ServiceRequestView[];
  // The order's conversation, so the result page can carry the same thread the
  // order detail screen does. Null when the order has none yet.
  conversationId: string | null;
};

// --- Helpers --------------------------------------------------------------

const STATUS_VIEW: Record<ServiceResultStatus, 'active' | 'archived'> = {
  [ServiceResultStatus.DRAFT]: 'active',
  [ServiceResultStatus.ACTIVE]: 'active',
  [ServiceResultStatus.ARCHIVED]: 'archived',
};

const REQUEST_STATUS_VIEW: Record<
  ServiceRequestStatus,
  ServiceRequestView['status']
> = {
  [ServiceRequestStatus.SUBMITTED]: 'submitted',
  [ServiceRequestStatus.IN_PROGRESS]: 'in_progress',
  [ServiceRequestStatus.BLOCKED]: 'blocked',
  [ServiceRequestStatus.COMPLETED]: 'completed',
  [ServiceRequestStatus.CANCELLED]: 'cancelled',
};

export const REQUEST_STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  [ServiceRequestStatus.SUBMITTED]: 'Submitted',
  [ServiceRequestStatus.IN_PROGRESS]: 'In progress',
  [ServiceRequestStatus.BLOCKED]: 'Blocked',
  [ServiceRequestStatus.COMPLETED]: 'Completed',
  [ServiceRequestStatus.CANCELLED]: 'Cancelled',
};

const REQUEST_OPEN_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.SUBMITTED,
  ServiceRequestStatus.IN_PROGRESS,
  ServiceRequestStatus.BLOCKED,
];

/*
 * The URL segment a service's page lives at: `/app/s/:slug`.
 *
 * Derived from the name rather than stored, so adding a service needs no second
 * field — and resolved back to an id by lookup, never by trusting the slug as a
 * key. A collision between two services with the same slug is broken by the id
 * suffix, which is why `resolveServiceSlug` matches on the computed value rather
 * than assuming uniqueness.
 */
export function serviceSlug(service: Pick<Service, 'id' | 'name'>): string {
  const base = service.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base.length > 0 ? base : `service-${service.id.slice(0, 8)}`;
}

const pageTitleOf = (service: Service): string =>
  service.resultPageTitle?.trim() || service.name;

const nounOf = (service: Service): string =>
  service.resultNoun?.trim() || 'record';

// Group a schema into the cards the detail page renders. Fields with no category
// fall into one leading "Details" section, so nothing is ever orphaned.
function sectionsOf(fields: ResultField[]): { title: string; fields: ResultField[] }[] {
  const sections = new Map<string, ResultField[]>();

  for (const field of fields) {
    const title = field.category?.trim() || 'Details';
    const existing = sections.get(title);
    if (existing) existing.push(field);
    else sections.set(title, [field]);
  }

  return [...sections].map(([title, sectionFields]) => ({
    title,
    fields: sectionFields,
  }));
}

// Values keyed by field, resolved against the schema. A stored value whose field
// has left the schema is dropped — the record renders what the service currently
// returns, not what it once did.
function valuesByKey(
  fields: ResultField[],
  rows: ServiceResultValue[],
): Record<string, ResultValueView> {
  const byKey = new Map(rows.map((row) => [row.fieldKey, row]));
  const out: Record<string, ResultValueView> = {};

  for (const field of fields) {
    const row = byKey.get(field.name);
    if (row) out[field.name] = toValueView(field, row);
  }

  return out;
}

// --- Sidebar / owned services --------------------------------------------

/*
 * The services this customer has delivered records for — the portal sidebar's
 * "My services" group.
 *
 * Grouped from the records themselves rather than from the catalog, which is
 * what makes the sidebar honest: a customer sees a link only for a service they
 * actually own something under, so no entry ever opens an empty page. A service
 * that has since been deactivated still appears while a record survives, because
 * the customer still owns the thing it delivered.
 */
export async function listOwnedServices(
  auth: AuthContext,
): Promise<CustomerServiceSummary[]> {
  const grouped = await prisma.serviceResult.groupBy({
    by: ['serviceId'],
    where: {
      customerId: auth.userId,
      deletedAt: null,
      ...CUSTOMER_FACING,
    },
    _count: { _all: true },
  });

  if (grouped.length === 0) return [];

  const services = await prisma.service.findMany({
    where: { id: { in: grouped.map((row) => row.serviceId) } },
  });

  const byId = new Map(services.map((service) => [service.id, service]));

  return grouped
    .flatMap((row) => {
      const service = byId.get(row.serviceId);
      if (!service) return [];

      return [
        {
          serviceId: service.id,
          slug: serviceSlug(service),
          name: service.name,
          pageTitle: pageTitleOf(service),
          noun: nounOf(service),
          iconKey: service.iconKey,
          count: row._count._all,
        },
      ];
    })
    .sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
}

/*
 * Resolve a URL slug to the service it names.
 *
 * The slug is computed, not stored, so this loads the candidate services and
 * matches on the computed value. Scoped to services the customer owns records
 * for: an unknown slug and a slug for somebody else's service are the same 404,
 * which is what keeps the URL from being an enumeration oracle.
 */
async function resolveServiceSlug(
  auth: AuthContext,
  slug: string,
): Promise<Service> {
  const owned = await prisma.serviceResult.findMany({
    where: {
      customerId: auth.userId,
      deletedAt: null,
      ...CUSTOMER_FACING,
    },
    select: { serviceId: true },
    distinct: ['serviceId'],
  });

  if (owned.length === 0) throw AppError.notFound('Service not found');

  const services = await prisma.service.findMany({
    where: { id: { in: owned.map((row) => row.serviceId) } },
  });

  const match = services.find((service) => serviceSlug(service) === slug);
  if (!match) throw AppError.notFound('Service not found');

  return match;
}

// --- The list page --------------------------------------------------------

export async function listResults(
  auth: AuthContext,
  slug: string,
  query: ListResultsQuery,
): Promise<ServiceResultListView> {
  const service = await resolveServiceSlug(auth, slug);

  const registry = await loadResultRegistry([service]);
  const schema = resolveResultRefs(storedResultRefs(service), registry);
  const columns = listFields(schema);

  const where: Prisma.ServiceResultWhereInput = {
    customerId: auth.userId,
    serviceId: service.id,
    deletedAt: null,
    ...CUSTOMER_FACING,
    // The tab narrows the status; the internal-service exclusion above still
    // applies, so this only ever tightens what CUSTOMER_FACING allowed.
    ...(query.status
      ? {
          status:
            query.status === 'archived'
              ? ServiceResultStatus.ARCHIVED
              : ServiceResultStatus.ACTIVE,
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { reference: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.serviceResult.count({ where }),
    prisma.serviceResult.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        values: true,
        order: { select: { reference: true } },
        requests: {
          where: { deletedAt: null, status: { in: REQUEST_OPEN_STATUSES } },
          select: { id: true },
        },
      },
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    service: {
      serviceId: service.id,
      slug,
      name: service.name,
      pageTitle: pageTitleOf(service),
      noun: nounOf(service),
      iconKey: service.iconKey,
      count: totalResults,
    },
    columns,
    rows: page.rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      status: STATUS_VIEW[row.status],
      orderId: row.orderId,
      orderReference: row.order.reference,
      deliveredAt: isoOrNull(row.deliveredAt),
      updatedAt: iso(row.updatedAt),
      values: valuesByKey(columns, row.values),
      openRequests: row.requests.length,
    })),
    nextCursor: page.nextCursor,
    totalResults,
  };
}

// --- The detail page ------------------------------------------------------

/*
 * Load a record and prove the caller owns it.
 *
 * The ownership clause is in the query rather than checked after: a record
 * belonging to somebody else and a record that does not exist must be the same
 * 404, or the endpoint tells an attacker which ids are real.
 */
async function loadOwnedResult(auth: AuthContext, resultId: string) {
  const result = await prisma.serviceResult.findFirst({
    where: {
      id: resultId,
      customerId: auth.userId,
      deletedAt: null,
      ...CUSTOMER_FACING,
    },
    include: {
      values: true,
      service: true,
      order: { select: { id: true, reference: true } },
      // The activity feed snapshots who wrote an entry, and `AuthContext` is
      // deliberately narrow (identity only) — so the name is read from the row
      // rather than from the session.
      customer: { select: { name: true } },
    },
  });

  if (!result) throw AppError.notFound('Record not found');
  return result;
}

/*
 * The request types a service currently offers, with their intake forms resolved
 * against the REQUEST field registry — the same vocabulary the order form uses,
 * so asking "which address?" reuses a question that already exists.
 */
async function requestTypesFor(serviceId: string): Promise<RequestTypeView[]> {
  const types = await prisma.serviceRequestType.findMany({
    where: { serviceId, active: true, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });

  if (types.length === 0) return [];

  const refsByType = new Map(
    types.map((type) => {
      const parsed = fieldRefsSchema.safeParse(type.fields ?? []);
      return [type.id, parsed.success ? parsed.data : []];
    }),
  );

  const keys = [...refsByType.values()].flatMap((refs) =>
    refs.map((ref) => ref.fieldKey),
  );
  const registry = await fieldsByKey(keys);

  return types.map((type) => {
    const refs = refsByType.get(type.id) ?? [];

    return {
      id: type.id,
      key: type.key,
      label: type.label,
      ...(type.description ? { description: type.description } : {}),
      ...(type.iconKey ? { iconKey: type.iconKey } : {}),
      ...(type.turnaround ? { turnaround: type.turnaround } : {}),
      fields: refs.flatMap((ref) => {
        const field = registry.get(ref.fieldKey);
        if (!field) return [];
        return [{ ...field, ...(ref.required ? { required: true } : {}) }];
      }),
    } as RequestTypeView;
  });
}

function toRequestView(
  request: ServiceRequest & { assignee?: { name: string } | null },
): ServiceRequestView {
  return {
    id: request.id,
    reference: request.reference,
    typeLabel: request.typeLabel,
    status: REQUEST_STATUS_VIEW[request.status],
    note: request.note,
    blockedReason: request.blockedReason,
    resolution: request.resolution,
    assigneeName: request.assignee?.name ?? null,
    createdAt: iso(request.createdAt),
    closedAt: isoOrNull(request.closedAt),
  };
}

export async function getResult(
  auth: AuthContext,
  resultId: string,
): Promise<ServiceResultDetailView> {
  const result = await loadOwnedResult(auth, resultId);

  const registry = await loadResultRegistry([result.service]);
  const schema = resolveResultRefs(storedResultRefs(result.service), registry);
  const values = valuesByKey(schema, result.values);

  /*
   * Presigned download links, minted here — after the ownership check above —
   * and never stored. A file whose object is not available yet simply has no
   * entry, and the screen renders its pending state (AGENTS.md, Security & PII).
   */
  const downloads: Record<string, string> = {};
  for (const row of result.values) {
    if (!row.objectKey) continue;
    const url = await presignObject(row.objectKey);
    if (url) downloads[row.fieldKey] = url;
  }

  const [requestTypes, requests, conversation] = await Promise.all([
    requestTypesFor(result.serviceId),
    prisma.serviceRequest.findMany({
      where: { resultId: result.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { assignee: { select: { name: true } } },
      take: 50,
    }),
    // The order's thread, so the result page carries the same conversation the
    // order detail screen does — one thread per order, not a second inbox.
    prisma.conversation.findFirst({
      where: { orderId: result.orderId, kind: 'ORDER', deletedAt: null },
      select: { id: true },
    }),
  ]);

  return {
    id: result.id,
    reference: result.reference,
    title: result.title,
    status: STATUS_VIEW[result.status],
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    serviceSlug: serviceSlug(result.service),
    pageTitle: pageTitleOf(result.service),
    orderId: result.orderId,
    orderReference: result.order.reference,
    deliveredAt: isoOrNull(result.deliveredAt),
    lastEditedAt: isoOrNull(result.lastEditedAt),
    sections: sectionsOf(schema),
    values,
    downloads,
    requestTypes,
    requests: requests.map(toRequestView),
    conversationId: conversation?.id ?? null,
  };
}

// --- Raising a request ----------------------------------------------------

function makeRequestReference(): string {
  return `REQ-${10_000 + Math.floor(Math.random() * 90_000)}`;
}

/*
 * Validate the intake answers against the request type's own field references.
 *
 * The same rules as the order form's `resolveAnswers`: every required question
 * must have a non-empty answer, a select's value must be one of its options, and
 * unknown keys are dropped so a client cannot stuff arbitrary data into the
 * record. The registry is only a closed set if this layer enforces it.
 */
async function resolveRequestAnswers(
  fields: RequestTypeView['fields'],
  raw: Record<string, unknown> | undefined,
): Promise<Record<string, string>> {
  const answers: Record<string, string> = {};

  for (const field of fields) {
    const value = raw?.[field.name];
    const text = typeof value === 'string' ? value.trim() : '';

    if (text.length === 0) {
      if (field.required) {
        throw AppError.validation(`"${field.label}" is required`, {
          fieldKey: field.name,
        });
      }
      continue;
    }

    if (field.type === 'select') {
      const match = field.options.find((option) => option.value === text);
      if (!match) {
        throw AppError.validation(
          `"${text}" is not a valid choice for "${field.label}"`,
          { fieldKey: field.name },
        );
      }
    }

    answers[field.name] = text;
  }

  return answers;
}

export async function createRequest(
  auth: AuthContext,
  resultId: string,
  input: CreateServiceRequestInput,
): Promise<ServiceRequestView> {
  const result = await loadOwnedResult(auth, resultId);

  // An archived record is a historical one — a dissolved company has nothing
  // left to request against, and letting a button raise work on it would put an
  // unworkable ticket in the queue.
  if (result.status === ServiceResultStatus.ARCHIVED) {
    throw AppError.businessRule(
      'This record is archived, so no new requests can be raised against it',
    );
  }

  const requestType = await prisma.serviceRequestType.findFirst({
    where: {
      id: input.requestTypeId,
      serviceId: result.serviceId,
      active: true,
      deletedAt: null,
    },
  });

  // Scoped to THIS record's service, so a valid id for another service's request
  // type cannot be used here.
  if (!requestType) throw AppError.notFound('Request type not found');

  const types = await requestTypesFor(result.serviceId);
  const resolved = types.find((type) => type.id === requestType.id);
  const answers = await resolveRequestAnswers(resolved?.fields ?? [], input.answers);

  const request = await createWithUniqueReference((reference) =>
    prisma.serviceRequest.create({
      data: {
        reference,
        resultId: result.id,
        requestTypeId: requestType.id,
        customerId: auth.userId,
        serviceId: result.serviceId,
        typeLabel: requestType.label,
        serviceName: result.serviceName,
        ...(Object.keys(answers).length > 0 ? { answers } : {}),
        note: input.note?.trim() || null,
        activity: {
          create: {
            author: 'CUSTOMER',
            authorName: result.customer.name,
            message: `Requested ${requestType.label}`,
          },
        },
      },
      include: { assignee: { select: { name: true } } },
    }),
  );

  return toRequestView(request);
}

async function createWithUniqueReference<T>(
  create: (reference: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await create(makeRequestReference());
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
  throw AppError.conflict('Could not allocate a unique request reference');
}

// --- The customer's request list -----------------------------------------

export async function listRequests(
  auth: AuthContext,
  query: ListRequestsQuery,
): Promise<{
  requests: (ServiceRequestView & { resultId: string; resultTitle: string })[];
  nextCursor: string | null;
  totalResults: number;
}> {
  const statusMap: Record<string, ServiceRequestStatus> = {
    submitted: ServiceRequestStatus.SUBMITTED,
    in_progress: ServiceRequestStatus.IN_PROGRESS,
    blocked: ServiceRequestStatus.BLOCKED,
    completed: ServiceRequestStatus.COMPLETED,
    cancelled: ServiceRequestStatus.CANCELLED,
  };

  const where: Prisma.ServiceRequestWhereInput = {
    customerId: auth.userId,
    deletedAt: null,
    // A request against an internal result would link to a page the customer
    // has no access to. Nothing can raise one today (an internal service
    // publishes no request types), so this keeps that true rather than fixing a
    // live bug.
    result: { is: { service: { is: { resultInternal: false } } } },
    ...(query.status ? { status: statusMap[query.status] } : {}),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { name: true } },
        result: { select: { id: true, title: true } },
      },
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    requests: page.rows.map((row) => ({
      ...toRequestView(row),
      resultId: row.result.id,
      resultTitle: row.result.title,
    })),
    nextCursor: page.nextCursor,
    totalResults,
  };
}

// Re-exported so the admin modules resolve a definition the same way the
// customer's does — one resolver, no drift.
export type { ResultFieldDefinition };
