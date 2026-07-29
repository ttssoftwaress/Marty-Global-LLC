import {
  OrderItemStatus,
  Prisma,
  ServiceRequestStatus,
  ServiceResultStatus,
  type Service,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { presignObject } from '../../../lib/storage.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import {
  isMailRoomService,
  provisionMailRoom,
} from '../../mailroom/mailroom.provisioning.js';
import {
  listFields,
  primaryField,
  resolveResultRefs,
  loadResultRegistry,
  storedResultRefs,
} from '../../results/results.fields.js';
import { coerceValue, titleFrom, toValueView } from '../../results/results.values.js';
import type { ResultField } from '../../results/results.validation.js';
import { hasPermission } from '../admin.guards.js';
import { serviceRequestScope } from '../admin.scope.js';
import { iso, isoOrNull, party, type Party } from '../admin.views.js';
import type {
  ListAdminRequestsQuery,
  ResultFileQuery,
  SaveResultInput,
  UpdateOrderItemStatusInput,
  UpdateRequestInput,
  UpdateResultStatusInput,
} from './delivery.validation.js';

/*
 * The staff side of service delivery: filling in what a customer receives, and
 * working the follow-up requests raised against it.
 *
 * All Prisma access for the admin half of `ServiceResult` and `ServiceRequest`
 * lives here. Two rules run through the whole file:
 *
 *   1. **A delivery is gated on its required fields.** Marking an order item
 *      complete opens the result form, and the record cannot go ACTIVE until
 *      every field the service marked required has a value. That is what stops a
 *      customer being told their filing is done and finding an empty page.
 *
 *   2. **Every write is audited, and none of them carry values.** A result holds
 *      the customer's own data (a company's registered address, a tax id), so
 *      the trail records WHICH keys changed and never WHAT they changed to
 *      (AGENTS.md, Security & PII).
 */

// --- Views ----------------------------------------------------------------

export type AdminResultValueView = ReturnType<typeof toValueView>;

export type AdminResultView = {
  id: string;
  reference: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  orderItemId: string;
  orderId: string;
  orderReference: string;
  serviceId: string;
  serviceName: string;
  customer: Party;
  // The schema staff fill in — resolved from the service, so the form is
  // entirely data-driven and a catalog change reshapes it with no deploy.
  fields: ResultField[];
  values: Record<string, AdminResultValueView>;
  deliveredAt: string | null;
  lastEditedAt: string | null;
  // Which required fields are still blank. The form disables its Deliver button
  // on this rather than re-deriving the rule in the browser — one definition of
  // "ready", enforced where it matters.
  missingRequired: string[];
};

// One service line on an order, as the admin order screen renders it.
export type AdminOrderItemView = {
  id: string;
  serviceId: string;
  serviceName: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt: string | null;
  // Whether this service returns anything at all. A service with no result
  // schema completes without a form — not every service delivers a record.
  hasResultSchema: boolean;
  result: AdminResultView | null;
};

export type AdminRequestRow = {
  id: string;
  reference: string;
  typeLabel: string;
  serviceName: string;
  status: 'submitted' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  customer: Party;
  assignee: Party | null;
  resultId: string;
  resultTitle: string;
  createdAt: string;
  closedAt: string | null;
};

export type AdminRequestDetail = AdminRequestRow & {
  note: string | null;
  blockedReason: string | null;
  resolution: string | null;
  // The intake answers, resolved to `{ label, value }` pairs so the screen
  // renders them without a second registry fetch.
  answers: { label: string; value: string }[];
  activity: {
    id: string;
    author: string;
    authorName: string;
    message: string;
    internal: boolean;
    occurredAt: string;
  }[];
  // The order's thread, so a request can be discussed with the customer in the
  // same conversation the order uses — never a second inbox.
  conversationId: string | null;
  orderId: string;
  orderReference: string;
};

const RESULT_STATUS_VIEW: Record<
  ServiceResultStatus,
  AdminResultView['status']
> = {
  [ServiceResultStatus.DRAFT]: 'draft',
  [ServiceResultStatus.ACTIVE]: 'active',
  [ServiceResultStatus.ARCHIVED]: 'archived',
};

const ITEM_STATUS_VIEW: Record<OrderItemStatus, AdminOrderItemView['status']> = {
  [OrderItemStatus.PENDING]: 'pending',
  [OrderItemStatus.IN_PROGRESS]: 'in_progress',
  [OrderItemStatus.COMPLETED]: 'completed',
};

const ITEM_STATUS_FROM_VIEW: Record<
  UpdateOrderItemStatusInput['status'],
  OrderItemStatus
> = {
  pending: OrderItemStatus.PENDING,
  in_progress: OrderItemStatus.IN_PROGRESS,
  completed: OrderItemStatus.COMPLETED,
};

const REQUEST_STATUS_VIEW: Record<
  ServiceRequestStatus,
  AdminRequestRow['status']
> = {
  [ServiceRequestStatus.SUBMITTED]: 'submitted',
  [ServiceRequestStatus.IN_PROGRESS]: 'in_progress',
  [ServiceRequestStatus.BLOCKED]: 'blocked',
  [ServiceRequestStatus.COMPLETED]: 'completed',
  [ServiceRequestStatus.CANCELLED]: 'cancelled',
};

// Keyed on the view union rather than `string`, so the lookup is total and the
// compiler proves every wire value maps to a real status.
const REQUEST_STATUS_FROM_VIEW: Record<
  AdminRequestRow['status'],
  ServiceRequestStatus
> = {
  submitted: ServiceRequestStatus.SUBMITTED,
  in_progress: ServiceRequestStatus.IN_PROGRESS,
  blocked: ServiceRequestStatus.BLOCKED,
  completed: ServiceRequestStatus.COMPLETED,
  cancelled: ServiceRequestStatus.CANCELLED,
};

// A request is closed once it reaches one of these — `closedAt` is stamped, and
// the queue's open filters exclude them.
const CLOSED_REQUEST_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.COMPLETED,
  ServiceRequestStatus.CANCELLED,
];

// --- Result form ----------------------------------------------------------

/*
 * Which required fields have no value. The single definition of "ready to
 * deliver": the form reads it to enable its button, and `saveResult` enforces it
 * before flipping a record to ACTIVE.
 */
function missingRequired(
  fields: ResultField[],
  values: Map<string, { value: string | null; objectKey: string | null }>,
): string[] {
  return fields
    .filter((field) => {
      if (!field.required) return false;

      const stored = values.get(field.name);
      if (!stored) return true;

      // A file's value IS its object key — a filename with no object behind it
      // is not a delivered document.
      return field.type === 'file'
        ? !stored.objectKey
        : !stored.value || stored.value.trim().length === 0;
    })
    .map((field) => field.name);
}

type ResultWithRelations = Prisma.ServiceResultGetPayload<{
  include: {
    values: true;
    service: true;
    order: { select: { id: true; reference: true } };
    customer: { select: { name: true } };
  };
}>;

function toResultView(
  result: ResultWithRelations,
  fields: ResultField[],
): AdminResultView {
  const values: Record<string, AdminResultValueView> = {};
  const byKey = new Map(result.values.map((row) => [row.fieldKey, row]));

  for (const field of fields) {
    const row = byKey.get(field.name);
    if (row) values[field.name] = toValueView(field, row);
  }

  return {
    id: result.id,
    reference: result.reference,
    title: result.title,
    status: RESULT_STATUS_VIEW[result.status],
    orderItemId: result.orderItemId,
    orderId: result.orderId,
    orderReference: result.order.reference,
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    customer: party(result.customer.name),
    fields,
    values,
    deliveredAt: isoOrNull(result.deliveredAt),
    lastEditedAt: isoOrNull(result.lastEditedAt),
    missingRequired: missingRequired(fields, byKey),
  };
}

const resultInclude = {
  values: true,
  service: true,
  order: { select: { id: true, reference: true } },
  customer: { select: { name: true } },
} satisfies Prisma.ServiceResultInclude;

/*
 * Load an order item and prove this actor may work it.
 *
 * Scoped exactly like the orders queue: a member without `orders.all` works the
 * filings assigned to them, so an item on somebody else's order 404s rather than
 * 403s — the same rule the rest of the admin portal follows, and the reason a
 * path id is never trusted on its own.
 */
async function loadWorkableItem(actor: AuthContext, orderItemId: string) {
  const seesAll = await hasPermission(actor, 'orders.all');
  const canAssign = await hasPermission(actor, 'orders.assign');

  const item = await prisma.orderItem.findFirst({
    where: {
      id: orderItemId,
      order: {
        deletedAt: null,
        ...(seesAll || canAssign ? {} : { assigneeId: actor.userId }),
      },
    },
    include: {
      service: true,
      order: { select: { id: true, reference: true, customerId: true } },
      result: { include: resultInclude },
    },
  });

  if (!item) throw AppError.notFound('Order item not found');
  return item;
}

function makeResultReference(): string {
  return `REC-${10_000 + Math.floor(Math.random() * 90_000)}`;
}

/*
 * The result form for one order item, creating the DRAFT record on first open.
 *
 * Creating on read rather than on save is what lets the form be a plain edit
 * screen: staff open it, type, and save, without the UI having to distinguish a
 * first save from a later one. A DRAFT is invisible to the customer, so an
 * abandoned one costs nothing.
 */
export async function getItemResult(
  actor: AuthContext,
  orderItemId: string,
): Promise<AdminOrderItemView> {
  const item = await loadWorkableItem(actor, orderItemId);
  const fields = await resolveSchema(item.service);

  const base = {
    id: item.id,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    status: ITEM_STATUS_VIEW[item.status],
    completedAt: isoOrNull(item.completedAt),
    hasResultSchema: fields.length > 0,
  };

  // A service that returns nothing has no form and no record — not every service
  // delivers something the customer can look at afterwards.
  if (fields.length === 0) return { ...base, result: null };

  if (item.result) {
    return { ...base, result: toResultView(item.result, fields) };
  }

  const created = await createWithUniqueReference((reference) =>
    prisma.serviceResult.create({
      data: {
        reference,
        orderItemId: item.id,
        orderId: item.orderId,
        customerId: item.order.customerId,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        status: ServiceResultStatus.DRAFT,
        // Replaced by the primary field's value on the first save; a draft has
        // nothing to title itself with yet.
        title: item.serviceName,
      },
      include: resultInclude,
    }),
  );

  return { ...base, result: toResultView(created, fields) };
}

async function resolveSchema(service: Service): Promise<ResultField[]> {
  const registry = await loadResultRegistry([service]);
  return resolveResultRefs(storedResultRefs(service), registry);
}

/*
 * Save the result form — as a draft, or as a delivery.
 *
 * The gate (rule 1) is enforced here and only here: `deliver` with a required
 * field still blank is a 422, and nothing is written. Validating before the
 * transaction rather than inside it means a rejected delivery leaves the draft
 * exactly as the staff member left it.
 */
export async function saveResult(
  actor: AuthContext,
  orderItemId: string,
  input: SaveResultInput,
): Promise<AdminOrderItemView> {
  const item = await loadWorkableItem(actor, orderItemId);
  const fields = await resolveSchema(item.service);

  if (fields.length === 0) {
    throw AppError.businessRule(
      `"${item.serviceName}" has no result schema, so there is nothing to fill in. Add one from the service catalog first.`,
    );
  }

  const byName = new Map(fields.map((field) => [field.name, field]));

  /*
   * Coerce every submitted value against its own field. Unknown keys are
   * dropped — the same rule the order form follows, so a hand-written payload
   * cannot stuff arbitrary data into a customer's record.
   */
  const coerced = new Map<string, ReturnType<typeof coerceValue>>();
  for (const value of input.values) {
    const field = byName.get(value.fieldKey);
    if (!field) continue;
    coerced.set(value.fieldKey, coerceValue(field, value));
  }

  // What the record will hold after this save: the values that survived, merged
  // over what is already stored for fields the form didn't send.
  const merged = new Map(
    item.result?.values.map((row) => [
      row.fieldKey,
      { value: row.value, objectKey: row.objectKey },
    ]) ?? [],
  );

  for (const [key, value] of coerced) {
    if (value) merged.set(key, { value: value.value, objectKey: value.objectKey ?? null });
    else merged.delete(key);
  }

  const missing = missingRequired(fields, merged);

  if (input.deliver && missing.length > 0) {
    const labels = missing
      .map((key) => byName.get(key)?.label ?? key)
      .join(', ');

    throw AppError.businessRule(
      `Fill in every required field before delivering this result: ${labels}`,
      { missingRequired: missing },
    );
  }

  const resultId = item.result?.id;
  if (!resultId) {
    throw AppError.businessRule(
      'Open the result form before saving it so the record exists',
    );
  }

  const primary = primaryField(fields);
  const now = new Date();

  // Set inside the transaction, read after it commits — the audit entry for a
  // provisioned mail room must not be written for a delivery that rolled back.
  let provisionedRoomId: string | null = null;

  const saved = await prisma.$transaction(async (tx) => {
    for (const [key, value] of coerced) {
      const definition = await tx.resultFieldDefinition.findUnique({
        where: { key },
        select: { id: true },
      });

      // The schema resolved this key from the registry a moment ago, so a miss
      // here means it was archived away mid-edit — skip rather than fail the
      // whole save for one field.
      if (!definition) continue;

      // A cleared field is removed rather than stored as an empty string, so
      // "no value" is one state and not two.
      if (!value) {
        await tx.serviceResultValue.deleteMany({
          where: { resultId, fieldKey: key },
        });
        continue;
      }

      await tx.serviceResultValue.upsert({
        where: { resultId_fieldKey: { resultId, fieldKey: key } },
        create: {
          resultId,
          fieldKey: key,
          fieldId: definition.id,
          value: value.value,
          ...(value.valueJson === undefined
            ? {}
            : { valueJson: value.valueJson as Prisma.InputJsonValue }),
          objectKey: value.objectKey ?? null,
          contentType: value.contentType ?? null,
          sizeBytes: value.sizeBytes ?? null,
        },
        update: {
          value: value.value,
          ...(value.valueJson === undefined
            ? {}
            : { valueJson: value.valueJson as Prisma.InputJsonValue }),
          objectKey: value.objectKey ?? null,
          contentType: value.contentType ?? null,
          sizeBytes: value.sizeBytes ?? null,
        },
      });
    }

    // The title is snapshotted from the primary value so the customer's list can
    // sort and search on it — re-derived on every save, so it cannot drift.
    const rows = await tx.serviceResultValue.findMany({ where: { resultId } });
    const primaryRow = primary
      ? rows.find((row) => row.fieldKey === primary.name)
      : undefined;

    const title = titleFrom(
      primary,
      primary && primaryRow ? toValueView(primary, primaryRow) : undefined,
      item.serviceName,
    );

    const existing = item.result;
    const becomingActive =
      input.deliver === true && existing?.status !== ServiceResultStatus.ACTIVE;

    await tx.serviceResult.update({
      where: { id: resultId },
      data: {
        title,
        lastEditedAt: now,
        ...(input.deliver
          ? {
              status: ServiceResultStatus.ACTIVE,
              // Stamped once — a re-delivery is an edit, not a second delivery.
              ...(becomingActive ? { deliveredAt: now } : {}),
            }
          : {}),
      },
    });

    /*
     * Delivering the result IS completing the service. Doing both in one
     * transaction is what keeps the two from disagreeing — an item marked
     * complete with a draft result would tell the customer their filing is done
     * while showing them nothing.
     */
    if (input.deliver) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: OrderItemStatus.COMPLETED, completedAt: now },
      });

      /*
       * The virtual mail room is delivered as a mail room, not as a record: the
       * result form only exists to capture the address, and this is what opens
       * the room the customer then sees at `/app/mailroom`.
       *
       * In the same transaction as the completion above, so an item can never be
       * marked complete without the room it promised.
       */
      if (isMailRoomService(item.serviceName)) {
        const outcome = await provisionMailRoom(tx, {
          orderItemId: item.id,
          customerId: item.order.customerId,
          values: new Map(rows.map((row) => [row.fieldKey, row.value ?? ''])),
        });

        if (outcome.provisioned) provisionedRoomId = outcome.roomId ?? null;
      }

      await tx.orderActivity.create({
        data: {
          orderId: item.orderId,
          author: 'TEAM',
          authorName: await actorName(actor),
          message: `${item.serviceName} completed — the result is now available.`,
        },
      });
    }

    return tx.serviceResult.findFirstOrThrow({
      where: { id: resultId },
      include: resultInclude,
    });
  });

  void record({
    actor,
    action: input.deliver
      ? AuditAction.RESULT_DELIVERED
      : AuditAction.RESULT_UPDATED,
    entityType: 'ServiceResult',
    entityId: resultId,
    // Which keys changed, never their values — a result holds the customer's own
    // data (AGENTS.md, Security & PII).
    metadata: {
      orderItemId: item.id,
      fieldKeys: [...coerced.keys()],
      delivered: input.deliver === true,
    },
  });

  // Opening a customer's mail room is a state change on its own record, so it
  // gets its own trail entry rather than a flag on the delivery's.
  if (provisionedRoomId) {
    void record({
      actor,
      action: AuditAction.MAIL_ROOM_PROVISIONED,
      entityType: 'MailRoom',
      entityId: provisionedRoomId,
      // Ids only — the address is the customer's own data (AGENTS.md, PII).
      metadata: { orderItemId: item.id, customerId: item.order.customerId },
    });
  }

  return {
    id: item.id,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    status: input.deliver ? 'completed' : ITEM_STATUS_VIEW[item.status],
    completedAt: input.deliver ? iso(now) : isoOrNull(item.completedAt),
    hasResultSchema: true,
    result: toResultView(saved, fields),
  };
}

// A staff member's display name for an activity entry. `AuthContext` is
// deliberately narrow (identity only), so the name is read from the row.
async function actorName(actor: AuthContext): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true },
  });

  return user?.name ?? 'Marty Global team';
}

async function createWithUniqueReference<T>(
  create: (reference: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await create(makeResultReference());
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
  throw AppError.conflict('Could not allocate a unique record reference');
}

// --- Order item status ----------------------------------------------------

/*
 * Move one service line without touching its result.
 *
 * COMPLETED is deliberately not reachable here when the service returns
 * something: completing it is what delivers the record, and that path runs
 * through `saveResult` so the required-field gate cannot be stepped around. A
 * service with no result schema completes here directly, because there is
 * nothing to fill in.
 */
export async function updateOrderItemStatus(
  actor: AuthContext,
  orderItemId: string,
  input: UpdateOrderItemStatusInput,
): Promise<AdminOrderItemView> {
  const item = await loadWorkableItem(actor, orderItemId);
  const fields = await resolveSchema(item.service);
  const next = ITEM_STATUS_FROM_VIEW[input.status];

  if (next === OrderItemStatus.COMPLETED && fields.length > 0) {
    throw AppError.businessRule(
      `"${item.serviceName}" delivers a result, so it is completed by filling in and delivering the result form.`,
      { orderItemId: item.id },
    );
  }

  const now = new Date();

  const updated = await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      status: next,
      completedAt: next === OrderItemStatus.COMPLETED ? now : null,
    },
  });

  void record({
    actor,
    action: AuditAction.ORDER_ITEM_STATUS_CHANGED,
    entityType: 'OrderItem',
    entityId: item.id,
    metadata: { from: item.status, to: next, orderId: item.orderId },
  });

  return {
    id: updated.id,
    serviceId: updated.serviceId,
    serviceName: updated.serviceName,
    status: ITEM_STATUS_VIEW[updated.status],
    completedAt: isoOrNull(updated.completedAt),
    hasResultSchema: fields.length > 0,
    result: item.result ? toResultView(item.result, fields) : null,
  };
}

/*
 * Load a delivered record by id and prove this actor may work it.
 *
 * The record's own half of `loadWorkableItem` — same rule, reached from the other
 * end. Both entry points into the result form resolve through an order item, but
 * these two act on the record directly, so the scope has to be stated here too;
 * shared so the two can never disagree about who may touch a record.
 */
async function loadWorkableResult(actor: AuthContext, resultId: string) {
  const seesAll = await hasPermission(actor, 'orders.all');
  const canAssign = await hasPermission(actor, 'orders.assign');

  const result = await prisma.serviceResult.findFirst({
    where: {
      id: resultId,
      deletedAt: null,
      order: {
        deletedAt: null,
        ...(seesAll || canAssign ? {} : { assigneeId: actor.userId }),
      },
    },
    include: resultInclude,
  });

  // 404 rather than 403, so a record this member does not hold is not confirmed
  // to exist (guards/ownership.ts).
  if (!result) throw AppError.notFound('Record not found');
  return result;
}

/*
 * A short-TTL link to one file on a delivered record — the View and Download
 * controls beside a `file` field on the result form.
 *
 * Staff produce these documents, but they are the customer's paperwork the moment
 * they are delivered, so the link is minted per click after the scope check above
 * and never stored (AGENTS.md, Security & PII). The form previously offered
 * Upload and Replace with no way to open what was already there, which made
 * checking a colleague's delivery — or re-reading your own before amending it —
 * impossible without asking the customer.
 */
export async function getResultFileLink(
  actor: AuthContext,
  resultId: string,
  fieldKey: string,
  query: ResultFileQuery,
): Promise<{ fieldKey: string; name: string; url: string; contentType: string | null }> {
  const result = await loadWorkableResult(actor, resultId);
  const row = result.values.find((value) => value.fieldKey === fieldKey);

  if (!row) throw AppError.notFound('File not found');

  /*
   * A file field's stored scalar is its display name and the object key is the
   * document itself, so a row with a name and no key is a label the operator
   * typed before uploading anything — nothing to sign.
   */
  if (!row.objectKey) {
    throw AppError.businessRule('That field has no document uploaded yet');
  }

  const url = await presignObject(row.objectKey, {
    disposition: query.disposition,
    // The customer-facing label, which is what the operator wrote it under and
    // what the customer's own download is named.
    fileName: row.value ?? fieldKey,
  });

  if (!url) {
    throw AppError.businessRule('That document cannot be opened right now');
  }

  /*
   * Audited as a read. A delivered record holds the customer's own data — a
   * certificate, a registration document — and who opened one is not recoverable
   * from anywhere else. The metadata carries keys and ids, never the file's name
   * or any value on the record.
   */
  void record({
    actor,
    action: AuditAction.RESULT_FILE_ACCESSED,
    entityType: 'ServiceResult',
    entityId: result.id,
    metadata: {
      fieldKey,
      orderId: result.orderId,
      disposition: query.disposition,
    },
  });

  return {
    fieldKey,
    name: row.value ?? 'Document',
    url,
    contentType: row.contentType,
  };
}

/*
 * Archive or reactivate a delivered record — a dissolved company, a lapsed
 * registration. Still readable by the customer either way; `ARCHIVED` is what
 * puts it behind the list page's second tab and blocks new requests against it.
 */
export async function updateResultStatus(
  actor: AuthContext,
  resultId: string,
  input: UpdateResultStatusInput,
): Promise<AdminResultView> {
  const existing = await loadWorkableResult(actor, resultId);

  // A draft has never been delivered, so there is nothing to archive yet.
  if (existing.status === ServiceResultStatus.DRAFT) {
    throw AppError.businessRule(
      'Deliver this record before changing its status',
    );
  }

  const next =
    input.status === 'archived'
      ? ServiceResultStatus.ARCHIVED
      : ServiceResultStatus.ACTIVE;

  const updated = await prisma.serviceResult.update({
    where: { id: resultId },
    data: { status: next },
    include: resultInclude,
  });

  void record({
    actor,
    action: AuditAction.RESULT_STATUS_CHANGED,
    entityType: 'ServiceResult',
    entityId: resultId,
    metadata: { from: existing.status, to: next },
  });

  return toResultView(updated, await resolveSchema(updated.service));
}

// --- The requests queue ---------------------------------------------------

export async function listRequests(
  actor: AuthContext,
  query: ListAdminRequestsQuery,
): Promise<{
  rows: AdminRequestRow[];
  nextCursor: string | null;
  totalResults: number;
}> {
  const scope = await serviceRequestScope(actor);

  const where: Prisma.ServiceRequestWhereInput = {
    ...scope,
    deletedAt: null,
    ...(query.status ? { status: REQUEST_STATUS_FROM_VIEW[query.status] } : {}),
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    ...(query.assignee === 'me' ? { assigneeId: actor.userId } : {}),
    ...(query.assignee === 'unassigned' ? { assigneeId: null } : {}),
    ...(query.search
      ? {
          OR: [
            { reference: { contains: query.search, mode: 'insensitive' } },
            { typeLabel: { contains: query.search, mode: 'insensitive' } },
            { result: { title: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.findMany({
      where,
      // Oldest first: a request queue is a backlog, and newest-first would let
      // the oldest ticket sink out of sight forever.
      orderBy: { createdAt: 'asc' },
      include: {
        customer: { select: { name: true } },
        assignee: { select: { name: true } },
        result: { select: { id: true, title: true } },
      },
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    rows: page.rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      typeLabel: row.typeLabel,
      serviceName: row.serviceName,
      status: REQUEST_STATUS_VIEW[row.status],
      customer: party(row.customer.name),
      assignee: row.assignee ? party(row.assignee.name) : null,
      resultId: row.result.id,
      resultTitle: row.result.title,
      createdAt: iso(row.createdAt),
      closedAt: isoOrNull(row.closedAt),
    })),
    nextCursor: page.nextCursor,
    totalResults,
  };
}

async function loadWorkableRequest(actor: AuthContext, requestId: string) {
  const scope = await serviceRequestScope(actor);

  const request = await prisma.serviceRequest.findFirst({
    where: { ...scope, id: requestId, deletedAt: null },
    include: {
      customer: { select: { name: true } },
      assignee: { select: { name: true } },
      result: {
        select: {
          id: true,
          title: true,
          orderId: true,
          order: { select: { reference: true } },
        },
      },
      activity: { orderBy: { occurredAt: 'asc' }, take: 200 },
    },
  });

  if (!request) throw AppError.notFound('Request not found');
  return request;
}

export async function getRequest(
  actor: AuthContext,
  requestId: string,
): Promise<AdminRequestDetail> {
  const request = await loadWorkableRequest(actor, requestId);

  const [conversation, answers] = await Promise.all([
    prisma.conversation.findFirst({
      where: { orderId: request.result.orderId, kind: 'ORDER', deletedAt: null },
      select: { id: true },
    }),
    resolveAnswers(request.answers),
  ]);

  return {
    id: request.id,
    reference: request.reference,
    typeLabel: request.typeLabel,
    serviceName: request.serviceName,
    status: REQUEST_STATUS_VIEW[request.status],
    customer: party(request.customer.name),
    assignee: request.assignee ? party(request.assignee.name) : null,
    resultId: request.result.id,
    resultTitle: request.result.title,
    createdAt: iso(request.createdAt),
    closedAt: isoOrNull(request.closedAt),
    note: request.note,
    blockedReason: request.blockedReason,
    resolution: request.resolution,
    answers,
    activity: request.activity.map((entry) => ({
      id: entry.id,
      author: entry.author,
      authorName: entry.authorName,
      message: entry.message,
      internal: entry.internal,
      occurredAt: iso(entry.occurredAt),
    })),
    conversationId: conversation?.id ?? null,
    orderId: request.result.orderId,
    orderReference: request.result.order.reference,
  };
}

/*
 * The intake answers as label/value pairs. Labels come from the REQUEST registry
 * — the same one the order form reads — so a re-worded question updates how
 * every past request displays, which is the intended behaviour: it is the same
 * question, worded better.
 */
async function resolveAnswers(
  stored: Prisma.JsonValue | null,
): Promise<{ label: string; value: string }[]> {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return [];

  const entries = Object.entries(stored as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  if (entries.length === 0) return [];

  const definitions = await prisma.fieldDefinition.findMany({
    where: { key: { in: entries.map(([key]) => key) } },
    select: { key: true, label: true },
  });

  const labels = new Map(definitions.map((d) => [d.key, d.label]));

  return entries.map(([key, value]) => ({
    label: labels.get(key) ?? key,
    value,
  }));
}

/*
 * Move a request through its workflow, reassign it, or add a note.
 *
 * Two pairings are enforced here rather than in the schema, because both are
 * business rules about a state rather than shapes of a payload:
 *   - BLOCKED needs a reason. It is what the customer is shown in place of
 *     progress, so blocking without one leaves them with a dead screen.
 *   - Leaving BLOCKED clears the reason, and leaving COMPLETED clears the
 *     resolution — a stale explanation must never outlive the state it explains.
 *
 * Reassignment carries the `orders.assign` grant, the same one that governs
 * handing an order to somebody else: deciding who works what is a rota decision,
 * distinct from working the thing you hold.
 */
export async function updateRequest(
  actor: AuthContext,
  requestId: string,
  input: UpdateRequestInput,
): Promise<AdminRequestDetail> {
  const request = await loadWorkableRequest(actor, requestId);

  if (input.assigneeId !== undefined) {
    if (!(await hasPermission(actor, 'orders.assign'))) {
      throw AppError.unauthorized('You cannot reassign requests');
    }

    if (input.assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: input.assigneeId,
          deletedAt: null,
          role: { in: [Role.STAFF, Role.ADMIN] },
        },
        select: { id: true },
      });

      if (!assignee) throw AppError.validation('Assignee must be a staff member');
    }
  }

  const next = input.status
    ? REQUEST_STATUS_FROM_VIEW[input.status]
    : request.status;

  if (next === ServiceRequestStatus.BLOCKED && !input.blockedReason?.trim()) {
    throw AppError.businessRule(
      'Explain why this request is blocked — the customer is shown this instead of progress',
    );
  }

  const now = new Date();
  const statusChanged = next !== request.status;
  const closing = CLOSED_REQUEST_STATUSES.includes(next);

  const name = await actorName(actor);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        ...(input.status ? { status: next } : {}),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        // A reason survives only while the request is blocked; a resolution only
        // while it is closed.
        ...(input.blockedReason === undefined
          ? next === ServiceRequestStatus.BLOCKED
            ? {}
            : { blockedReason: null }
          : { blockedReason: input.blockedReason || null }),
        ...(input.resolution === undefined
          ? closing
            ? {}
            : { resolution: null }
          : { resolution: input.resolution || null }),
        ...(statusChanged && next === ServiceRequestStatus.IN_PROGRESS && !request.startedAt
          ? { startedAt: now }
          : {}),
        ...(statusChanged ? (closing ? { closedAt: now } : { closedAt: null }) : {}),
      },
    });

    if (statusChanged) {
      await tx.serviceRequestActivity.create({
        data: {
          requestId,
          author: 'TEAM',
          authorName: name,
          message: `Status changed to ${REQUEST_STATUS_VIEW[next].replace('_', ' ')}`,
        },
      });
    }

    if (input.note?.trim()) {
      await tx.serviceRequestActivity.create({
        data: {
          requestId,
          author: 'TEAM',
          authorName: name,
          message: input.note.trim(),
          internal: input.internal ?? false,
        },
      });
    }

    return true;
  });

  void updated;

  if (statusChanged) {
    void record({
      actor,
      action: AuditAction.SERVICE_REQUEST_STATUS_CHANGED,
      entityType: 'ServiceRequest',
      entityId: requestId,
      metadata: { from: request.status, to: next },
    });
  }

  if (input.assigneeId !== undefined) {
    void record({
      actor,
      action: AuditAction.SERVICE_REQUEST_ASSIGNED,
      entityType: 'ServiceRequest',
      entityId: requestId,
      metadata: { from: request.assigneeId, to: input.assigneeId },
    });
  }

  return getRequest(actor, requestId);
}

/*
 * The result behind a request, as the staff screen edits it — this is what makes
 * "edit the result page so they can enter new data as per the request" work
 * without leaving the request.
 *
 * It resolves the request to its record and hands back the same view the order
 * screen's form uses, so one form component serves both places.
 */
export async function getRequestResult(
  actor: AuthContext,
  requestId: string,
): Promise<AdminOrderItemView> {
  return getItemResult(actor, await orderItemForRequest(actor, requestId));
}

/*
 * Saving that amendment. It runs the same `saveResult` the order screen does, so
 * the required-field gate, the title snapshot, and the audit entry are identical
 * whichever screen the edit came from — one write path, no second implementation
 * to drift.
 */
export async function saveRequestResult(
  actor: AuthContext,
  requestId: string,
  input: SaveResultInput,
): Promise<AdminOrderItemView> {
  const orderItemId = await orderItemForRequest(actor, requestId);
  const saved = await saveResult(actor, orderItemId, input);

  await prisma.serviceRequestActivity.create({
    data: {
      requestId,
      author: 'TEAM',
      authorName: await actorName(actor),
      message: 'Updated the delivered record',
    },
  });

  return saved;
}

/*
 * The order item behind a request.
 *
 * Resolved through `loadWorkableRequest`, which applies the request scope — so
 * reaching a record this way proves the member holds a request for it. That is
 * what keeps the `requests` area from doubling as a way to browse every
 * delivered record in the org.
 *
 * `saveResult` then applies its own `orders`-based scope on top. A support agent
 * without `orders` therefore gets a 404 on the write even though the request was
 * theirs, which is the correct reading: they may work the ticket, but amending a
 * filing's record is the filer's job.
 */
async function orderItemForRequest(
  actor: AuthContext,
  requestId: string,
): Promise<string> {
  const request = await loadWorkableRequest(actor, requestId);

  const result = await prisma.serviceResult.findFirst({
    where: { id: request.result.id, deletedAt: null },
    select: { orderItemId: true },
  });

  if (!result) throw AppError.notFound('Record not found');
  return result.orderItemId;
}

export { listFields as resultListFields };
