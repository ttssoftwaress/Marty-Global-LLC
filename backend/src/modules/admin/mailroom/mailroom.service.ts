import {
  MailItemStatus,
  MailLogAction,
  MailRequestStatus,
  MailRequestType,
  MailRoomStatus,
  Prisma,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { toInitials } from '../../../lib/initials.js';
import { cursorArgs, offsetArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { presignObject } from '../../../lib/storage.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import {
  notifyMailRequestResolved,
  notifyMailScanFiled,
} from '../../mailroom/mailroom.notifications.js';
import { assertKeyKind } from '../../uploads/uploads.service.js';
import { canSeeAll } from '../admin.guards.js';
import {
  customerScope,
  mailItemScope,
  mailLogScope,
  mailRequestScope,
  scopeLabel,
  type DataScope,
} from '../admin.scope.js';
import { iso } from '../admin.views.js';
import type {
  ListLogQuery,
  ListRequestsQuery,
  ListScansQuery,
  ResolveRequestInput,
  UploadScanInput,
} from './mailroom.validation.js';

/*
 * Admin virtual mail operations — filing scans into customers' inboxes, working
 * the forwarding/shredding queue, and the closed history. All Prisma access for
 * these screens lives here.
 *
 * Scans and their pages are R2 object keys, never URLs: a link is minted as a
 * short-TTL presigned URL at read time, and only for the one request an operator
 * actually opened (AGENTS.md, Security & PII). That is why the queue rows carry
 * no preview link and the detail endpoint does.
 */

// How long a filed scan is retained before it is shredded. The inbox flags an
// item approaching this date so the customer can ask for forwarding in time.
const STORAGE_DAYS = 30;

// --- Summary -------------------------------------------------------------
export type MailOpsSummary = {
  kpis: { id: string; label: string; value: string }[];
  tabs: { value: string; label: string; count: number | null }[];
  // Whether these counts cover the whole mail room or only the customers this
  // actor deals with.
  scope: DataScope;
};

const OPEN_REQUEST_STATUSES: readonly MailRequestStatus[] = [
  MailRequestStatus.PENDING,
  MailRequestStatus.PROCESSING,
];

export async function getSummary(actor: AuthContext): Promise<MailOpsSummary> {
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // Resolved once and spread into every count, so the KPI figures and the tab
  // badges can never describe a wider set than the lists beneath them.
  const itemWhere = await mailItemScope(actor);
  const requestWhere = await mailRequestScope(actor);
  const logWhere = await mailLogScope(actor);

  const [filedToday, openRequests, awaitingScan, logEntries] = await Promise.all([
    prisma.mailItem.count({
      where: { ...itemWhere, deletedAt: null, createdAt: { gte: startOfDay } },
    }),
    prisma.mailRequest.count({
      where: {
        ...requestWhere,
        deletedAt: null,
        status: { in: [...OPEN_REQUEST_STATUSES] },
      },
    }),
    // Filed but not yet processed into pages — the operator's own backlog.
    prisma.mailItem.count({
      where: { ...itemWhere, deletedAt: null, scanReady: false },
    }),
    prisma.mailActionLog.count({ where: logWhere }),
  ]);

  return {
    scope: scopeLabel(await canSeeAll(actor, 'mailroom')),
    kpis: [
      { id: 'filed-today', label: 'Scans filed today', value: String(filedToday) },
      { id: 'pending-requests', label: 'Pending requests', value: String(openRequests) },
      { id: 'awaiting-scan', label: 'Awaiting scan', value: String(awaitingScan) },
    ],
    // A null count prints no badge, which is what the two undesigned tabs want.
    tabs: [
      { value: 'upload', label: 'Upload mail', count: null },
      { value: 'pending', label: 'Pending requests', count: openRequests },
      { value: 'log', label: 'Mail log', count: logEntries },
      { value: 'settings', label: 'Settings', count: null },
    ],
  };
}

// --- Customer picker -----------------------------------------------------
export type MailOpsCustomer = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

const customerSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;

const toCustomer = (user: {
  id: string;
  name: string;
  email: string;
}): MailOpsCustomer => ({
  id: user.id,
  name: user.name,
  email: user.email,
  initials: toInitials(user.name),
});

/*
 * The picker an operator files a scan from. Scoped like every other read: a
 * member who may not see a customer's records must not be able to enumerate the
 * directory through a search box either — a `take: 10` on an unscoped query is
 * still the whole table, ten rows at a time.
 */
export async function searchCustomers(
  actor: AuthContext,
  search: string,
): Promise<MailOpsCustomer[]> {
  const customers = await prisma.user.findMany({
    where: {
      ...(await customerScope(actor)),
      deletedAt: null,
      OR: [{ role: Role.CUSTOMER }, { role: null }],
      AND: [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: customerSelect,
    orderBy: { name: 'asc' },
    // A picker, not a list: enough to choose from, never the whole table.
    take: 10,
  });

  return customers.map(toCustomer);
}

// --- Recently uploaded ---------------------------------------------------
export type MailOpsRecentUpload = {
  id: string;
  customer: MailOpsCustomer;
  sender: string;
  uploadedAt: string;
};

export async function listScans(
  actor: AuthContext,
  query: ListScansQuery,
): Promise<{
  uploads: MailOpsRecentUpload[];
  nextCursor: string | null;
}> {
  const rows = await prisma.mailItem.findMany({
    where: { ...(await mailItemScope(actor)), deletedAt: null },
    include: { room: { include: { customer: { select: customerSelect } } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(query.cursor, query.limit),
  });

  const page = takePage(rows, query.limit);

  return {
    uploads: page.rows.map((item) => ({
      id: item.id,
      customer: toCustomer(item.room.customer),
      sender: item.sender,
      uploadedAt: iso(item.createdAt),
    })),
    nextCursor: page.nextCursor,
  };
}

/*
 * File a scan into a customer's inbox.
 *
 * A customer may hold several rooms; the scan lands in their active one. If they
 * have none, that is a business-rule failure rather than a silently created
 * room — mail arriving for a customer without an address means something is
 * wrong upstream, and an operator should see it.
 */
export async function uploadScan(
  actor: AuthContext,
  input: UploadScanInput,
): Promise<MailOpsRecentUpload> {
  /*
   * Scoped on the way in: filing a scan into a customer's inbox is a write
   * against a record this actor must be entitled to reach. Out of scope reads as
   * "no room to file into" — the same answer as a customer who genuinely has
   * none, so the failure does not confirm the account exists.
   */
  const room = await prisma.mailRoom.findFirst({
    where: {
      customerId: input.customerId,
      deletedAt: null,
      status: MailRoomStatus.ACTIVE,
      customer: { is: await customerScope(actor) },
    },
    include: { customer: { select: customerSelect } },
    orderBy: { createdAt: 'desc' },
  });

  if (!room) {
    throw AppError.businessRule('This customer has no active mail room to file into');
  }

  // A calendar date anchored at midnight UTC — the day the envelope arrived, not
  // a moment in the operator's zone (AGENTS.md, Dates).
  const receivedAt = new Date(`${input.receivedOn}T00:00:00.000Z`);
  if (Number.isNaN(receivedAt.getTime())) {
    throw AppError.validation('receivedOn is not a real date');
  }

  const storageExpiresAt = new Date(receivedAt);
  storageExpiresAt.setUTCDate(storageExpiresAt.getUTCDate() + STORAGE_DAYS);

  /*
   * Every key is checked to be one this module's uploads mint. The keys are
   * unguessable, so this is a second line of defence: it stops a key obtained
   * for some other purpose from being filed as a customer's mail.
   */
  for (const file of input.files) {
    assertKeyKind('mail-scan', file.objectKey);
  }

  /*
   * The item's downloadable PDF, when one of the uploads is a PDF. We do not
   * merge images into a PDF or split a PDF into pages — there is no document
   * library in the stack budget (AGENTS.md) — so this points at the first PDF
   * the operator attached, and images stay images the viewer draws inline.
   */
  const pdf = input.files.find(
    (file) => file.contentType.toLowerCase() === 'application/pdf',
  );

  const item = await prisma.mailItem.create({
    data: {
      roomId: room.id,
      sender: input.sender,
      status: MailItemStatus.NEW,
      receivedAt,
      storageExpiresAt,
      // The objects exist — the operator uploaded them before submitting — so the
      // item is readable immediately rather than sitting in a scanning state.
      scanReady: true,
      note: input.notes ?? null,
      pdfObjectKey: pdf?.objectKey ?? null,
      // Position in the upload IS the page number; the operator attached them in
      // the order the envelope reads.
      pages: {
        create: input.files.map((file, index) => ({
          pageNumber: index + 1,
          objectKey: file.objectKey,
          fileName: file.fileName,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes ?? null,
        })),
      },
    },
  });

  void record({
    actor,
    action: AuditAction.MAIL_SCAN_UPLOADED,
    entityType: 'MailItem',
    entityId: item.id,
    // Ids and the room only — the sender is on an envelope and counts as PII.
    metadata: { roomId: room.id, customerId: input.customerId, files: input.files.length },
  });

  /*
   * Tell the customer post has arrived. Queued and preference-gated inside
   * `notifyMailScanFiled`, and never awaited on the operator's request: a
   * notification that fails to enqueue must not fail the filing that already
   * happened (AGENTS.md — email always from a queued job).
   */
  void notifyMailScanFiled({
    customerId: input.customerId,
    customerEmail: room.customer.email,
    roomId: room.id,
    roomName: room.name,
    sender: item.sender,
  });

  return {
    id: item.id,
    customer: toCustomer(room.customer),
    sender: item.sender,
    uploadedAt: iso(item.createdAt),
  };
}

// --- Pending requests ----------------------------------------------------
export type MailRequestRow = {
  id: string;
  customer: MailOpsCustomer;
  mailItem: string;
  type: 'forwarding' | 'shredding';
  typeLabel: string;
  status: 'pending' | 'processing' | 'completed';
  statusLabel: string;
  requestedAt: string;
};

const TYPE_VIEW: Record<MailRequestType, MailRequestRow['type']> = {
  [MailRequestType.FORWARDING]: 'forwarding',
  [MailRequestType.SHREDDING]: 'shredding',
};

const TYPE_LABEL: Record<MailRequestType, string> = {
  [MailRequestType.FORWARDING]: 'Forwarding',
  [MailRequestType.SHREDDING]: 'Shredding',
};

const REQUEST_STATUS_VIEW: Record<MailRequestStatus, MailRequestRow['status']> = {
  [MailRequestStatus.PENDING]: 'pending',
  [MailRequestStatus.PROCESSING]: 'processing',
  [MailRequestStatus.COMPLETED]: 'completed',
};

const REQUEST_STATUS_LABEL: Record<MailRequestStatus, string> = {
  [MailRequestStatus.PENDING]: 'Pending',
  [MailRequestStatus.PROCESSING]: 'Processing',
  [MailRequestStatus.COMPLETED]: 'Completed',
};

function requestFilterWhere(filter: ListRequestsQuery['filter']): Prisma.MailRequestWhereInput {
  switch (filter) {
    case 'forwarding':
      return { type: MailRequestType.FORWARDING, status: { in: [...OPEN_REQUEST_STATUSES] } };
    case 'shredding':
      return { type: MailRequestType.SHREDDING, status: { in: [...OPEN_REQUEST_STATUSES] } };
    case 'completed':
      return { status: MailRequestStatus.COMPLETED };
    case 'all':
      // The queue is work waiting to be done, so "All" is the open backlog —
      // completed requests have their own tab and the mail log behind them.
      return { status: { in: [...OPEN_REQUEST_STATUSES] } };
  }
}

const requestInclude = {
  customer: { select: customerSelect },
  mailItem: {
    select: {
      sender: true,
      pdfObjectKey: true,
      // The room the item sits in, so settling a request can link the customer
      // straight to the inbox it came from.
      roomId: true,
      pages: { orderBy: { pageNumber: 'asc' }, take: 1, select: { objectKey: true } },
    },
  },
} satisfies Prisma.MailRequestInclude;

type RequestRow = Prisma.MailRequestGetPayload<{ include: typeof requestInclude }>;

function toRequestRow(request: RequestRow): MailRequestRow {
  return {
    id: request.id,
    customer: toCustomer(request.customer),
    mailItem: request.mailItem.sender,
    type: TYPE_VIEW[request.type],
    typeLabel: TYPE_LABEL[request.type],
    status: REQUEST_STATUS_VIEW[request.status],
    statusLabel: REQUEST_STATUS_LABEL[request.status],
    requestedAt: iso(request.requestedAt),
  };
}

export type MailRequestPage = {
  requests: MailRequestRow[];
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
};

/*
 * Offset-paginated, unlike every other admin list. The design's footer prints an
 * absolute range ("Showing 1–10 of 34") and a jumpable page strip, and a cursor
 * can answer neither. The frontend documents this as a deliberate exception.
 */
export async function listRequests(
  actor: AuthContext,
  query: ListRequestsQuery,
): Promise<MailRequestPage> {
  const where: Prisma.MailRequestWhereInput = {
    ...(await mailRequestScope(actor)),
    deletedAt: null,
    ...requestFilterWhere(query.filter),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.mailRequest.count({ where }),
    prisma.mailRequest.findMany({
      where,
      include: requestInclude,
      // Oldest first: a queue is worked in the order it arrived.
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
      ...offsetArgs(query.page, query.pageSize),
    }),
  ]);

  return {
    requests: rows.map(toRequestRow),
    page: query.page,
    pageSize: query.pageSize,
    totalResults,
    totalPages: totalPages(totalResults, query.pageSize),
  };
}

export type MailRequestDetail = MailRequestRow & {
  document: { fileName: string; previewUrl: string | null };
  shippingAddress: string | null;
  carriers: { value: string; label: string }[];
};

/*
 * The scope matters more here than anywhere else in the module: this is the one
 * read that mints a presigned URL to a customer's scanned mail (AGENTS.md,
 * Security & PII — files are served only after an ownership check in the service
 * layer). An out-of-scope id must 404 before that URL is ever minted, which is
 * why the clause is in the lookup rather than checked afterwards.
 */
export async function getRequest(
  actor: AuthContext,
  requestId: string,
): Promise<MailRequestDetail> {
  const request = await prisma.mailRequest.findFirst({
    where: { ...(await mailRequestScope(actor)), id: requestId, deletedAt: null },
    include: requestInclude,
  });

  if (!request) throw AppError.notFound('Request not found');

  const carriers = await prisma.mailCarrier.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { code: true, label: true },
  });

  // The scan's combined PDF if it exists, else its first page. Presigned only
  // here, for the one request the operator opened — minting short-TTL URLs for
  // every row of a list both wastes them and widens what the list exposes.
  const objectKey =
    request.mailItem.pdfObjectKey ?? request.mailItem.pages[0]?.objectKey ?? null;

  return {
    ...toRequestRow(request),
    document: {
      fileName: `${request.mailItem.sender} scan.pdf`,
      // Null while the scan is still processing — the card disables "Preview
      // document" rather than pointing at a dead link.
      previewUrl: (await presignObject(objectKey)) ?? null,
    },
    // A shredding request has nowhere to ship to; the design drops that row.
    shippingAddress:
      request.type === MailRequestType.FORWARDING ? request.shippingAddress : null,
    carriers: carriers.map((carrier) => ({ value: carrier.code, label: carrier.label })),
  };
}

// --- Working a request ---------------------------------------------------
/*
 * The queue row's one-click advance: PENDING → PROCESSING. It does not settle
 * anything, so nothing is logged to the mail history yet — that happens on
 * resolve. Re-processing an already-processing request is a no-op rather than an
 * error, so a double-click cannot break the queue.
 */
export async function processRequest(
  actor: AuthContext,
  requestId: string,
): Promise<MailRequestRow> {
  const request = await prisma.mailRequest.findFirst({
    where: { ...(await mailRequestScope(actor)), id: requestId, deletedAt: null },
    include: requestInclude,
  });

  if (!request) throw AppError.notFound('Request not found');

  if (request.status === MailRequestStatus.COMPLETED) {
    throw AppError.businessRule('This request has already been completed');
  }

  if (request.status === MailRequestStatus.PROCESSING) {
    return toRequestRow(request);
  }

  const updated = await prisma.mailRequest.update({
    where: { id: requestId },
    data: { status: MailRequestStatus.PROCESSING },
    include: requestInclude,
  });

  void record({
    actor,
    action: AuditAction.MAIL_REQUEST_PROCESSED,
    entityType: 'MailRequest',
    entityId: requestId,
    metadata: { type: request.type, from: request.status, to: updated.status },
  });

  return toRequestRow(updated);
}

const RESOLUTION_ACTION: Record<MailRequestType, MailLogAction> = {
  [MailRequestType.FORWARDING]: MailLogAction.FORWARDED,
  [MailRequestType.SHREDDING]: MailLogAction.SHREDDED,
};

const RESOLUTION_ITEM_STATUS: Record<MailRequestType, MailItemStatus> = {
  [MailRequestType.FORWARDING]: MailItemStatus.FORWARDED,
  [MailRequestType.SHREDDING]: MailItemStatus.ARCHIVED,
};

/*
 * Settle a request. The backend decides what settling means for the request's
 * type — forwarded or shredded, and what that leaves the mail item as — so the
 * client only reports what the operator entered (AGENTS.md).
 *
 * One transaction across three writes: the request closes, the item takes its
 * new state, and the mail log gains the row that is the only permanent record of
 * the disposal. A partial apply would leave a closed request with no history, or
 * history for a request still sitting in the queue.
 */
export async function resolveRequest(
  actor: AuthContext,
  requestId: string,
  input: ResolveRequestInput,
): Promise<MailRequestRow> {
  const request = await prisma.mailRequest.findFirst({
    where: { ...(await mailRequestScope(actor)), id: requestId, deletedAt: null },
    include: requestInclude,
  });

  if (!request) throw AppError.notFound('Request not found');

  if (request.status === MailRequestStatus.COMPLETED) {
    throw AppError.businessRule('This request has already been completed');
  }

  if (request.type === MailRequestType.FORWARDING && !input.carrier) {
    throw AppError.validation('A forwarding request needs the carrier it shipped with');
  }

  const actorName = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true },
  });

  const processedByName = actorName?.name ?? 'Marty Global team';
  const processedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const settled = await tx.mailRequest.update({
      where: { id: requestId },
      data: {
        status: MailRequestStatus.COMPLETED,
        carrier: input.carrier ?? null,
        trackingNumber: input.trackingNumber ?? null,
        notes: input.notes ?? null,
        processedById: actor.userId,
        processedByName,
        processedAt,
      },
      include: requestInclude,
    });

    await tx.mailItem.update({
      where: { id: request.mailItemId },
      data: { status: RESOLUTION_ITEM_STATUS[request.type] },
    });

    await tx.mailActionLog.create({
      data: {
        mailItemId: request.mailItemId,
        customerId: request.customerId,
        action: RESOLUTION_ACTION[request.type],
        // Snapshotted: the log must still read after the item is purged on its
        // storage-expiry date.
        mailItemLabel: request.mailItem.sender,
        processedById: actor.userId,
        processedByName,
        closedAt: processedAt,
      },
    });

    return settled;
  });

  void record({
    actor,
    action: AuditAction.MAIL_REQUEST_RESOLVED,
    entityType: 'MailRequest',
    entityId: requestId,
    // A tracking number identifies a shipment to a home address, so it stays out
    // of the trail; the fact that one was recorded does not.
    metadata: {
      type: request.type,
      hasTracking: Boolean(input.trackingNumber),
      carrier: input.carrier ?? null,
    },
  });

  /*
   * The customer asked us to do something with their post and we have now done
   * it, so this is the one mail event they are most owed. Queued, preference-
   * gated, and never awaited — settling the request already succeeded.
   */
  const carrierLabel = input.carrier
    ? (
        await prisma.mailCarrier.findUnique({
          where: { code: input.carrier },
          select: { label: true },
        })
      )?.label ?? input.carrier
    : null;

  void notifyMailRequestResolved({
    customerId: request.customerId,
    customerEmail: request.customer.email,
    roomId: request.mailItem.roomId,
    mailItemLabel: request.mailItem.sender,
    type: TYPE_VIEW[request.type],
    trackingNumber: input.trackingNumber ?? null,
    carrierLabel,
  });

  return toRequestRow(updated);
}

// --- Mail log ------------------------------------------------------------
export type MailLogPage = {
  entries: {
    id: string;
    customer: MailOpsCustomer;
    mailItem: string;
    action: 'forwarded' | 'shredded' | 'downloaded';
    actionLabel: string;
    closedAt: string;
    processedBy: string;
  }[];
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
};

const LOG_ACTION_VIEW: Record<MailLogAction, MailLogPage['entries'][number]['action']> = {
  [MailLogAction.FORWARDED]: 'forwarded',
  [MailLogAction.SHREDDED]: 'shredded',
  [MailLogAction.DOWNLOADED]: 'downloaded',
};

const LOG_ACTION_LABEL: Record<MailLogAction, string> = {
  [MailLogAction.FORWARDED]: 'Forwarded',
  [MailLogAction.SHREDDED]: 'Shredded',
  [MailLogAction.DOWNLOADED]: 'Downloaded only',
};

const VIEW_TO_LOG_ACTION: Record<string, MailLogAction> = {
  forwarded: MailLogAction.FORWARDED,
  shredded: MailLogAction.SHREDDED,
  downloaded: MailLogAction.DOWNLOADED,
};

function logCutoff(range: ListLogQuery['range'], now: Date): Date | undefined {
  if (range === 'all') return undefined;

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90));
  return cutoff;
}

export async function listLog(
  actor: AuthContext,
  query: ListLogQuery,
): Promise<MailLogPage> {
  const cutoff = logCutoff(query.range, new Date());
  const action = query.action === 'all' ? undefined : VIEW_TO_LOG_ACTION[query.action];

  const where: Prisma.MailActionLogWhereInput = {
    ...(await mailLogScope(actor)),
    ...(action ? { action } : {}),
    ...(cutoff ? { closedAt: { gte: cutoff } } : {}),
    ...(query.search
      ? {
          OR: [
            { mailItemLabel: { contains: query.search, mode: 'insensitive' } },
            { processedByName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.mailActionLog.count({ where }),
    prisma.mailActionLog.findMany({
      where,
      include: { mailItem: { select: { room: { select: { customer: { select: customerSelect } } } } } },
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
      ...offsetArgs(query.page, query.pageSize),
    }),
  ]);

  return {
    entries: rows.map((entry) => ({
      id: entry.id,
      customer: toCustomer(entry.mailItem.room.customer),
      mailItem: entry.mailItemLabel,
      action: LOG_ACTION_VIEW[entry.action],
      actionLabel: LOG_ACTION_LABEL[entry.action],
      closedAt: iso(entry.closedAt),
      processedBy: entry.processedByName,
    })),
    page: query.page,
    pageSize: query.pageSize,
    totalResults,
    totalPages: totalPages(totalResults, query.pageSize),
  };
}
