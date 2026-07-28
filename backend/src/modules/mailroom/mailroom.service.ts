import {
  MailItemStatus,
  MailLogAction,
  MailRequestStatus as PrismaMailRequestStatus,
  MailRequestType as PrismaMailRequestType,
  MailRoomStatus,
  Prisma,
} from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { assertFound } from '../../guards/ownership.js';
import { AppError } from '../../lib/app-error.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject, presignObjects } from '../../lib/storage.js';
import { notifyStaffMailRequest } from '../admin/admin.notifications.js';
import type {
  CreateMailRequestInput,
  ListMailItemsQuery,
  MailRequestType,
  MailRoomTab,
  MailStatusFilter,
} from './mailroom.validation.js';

/*
 * Virtual mail rooms: the rooms overview, one room's detail, and that room's
 * scanned inbox. All Prisma access and every ownership check live here; the
 * controller is an adapter.
 *
 * The counts the screens show are derived from the item rows on every read,
 * never stored — a stored counter drifts the moment a job or an admin touches an
 * item outside the path that increments it (schema.prisma says the same).
 */

// --- Status → view mappings ----------------------------------------------
// The frontend renders lowercase; Prisma stores the enum uppercase.
const ROOM_STATUS_TO_VIEW: Record<MailRoomStatus, string> = {
  [MailRoomStatus.ACTIVE]: 'active',
  [MailRoomStatus.PENDING]: 'pending',
  [MailRoomStatus.SUSPENDED]: 'suspended',
};

const ITEM_STATUS_TO_VIEW: Record<MailItemStatus, string> = {
  [MailItemStatus.NEW]: 'new',
  [MailItemStatus.VIEWED]: 'viewed',
  [MailItemStatus.SCANNED]: 'scanned',
  [MailItemStatus.FORWARDED]: 'forwarded',
  [MailItemStatus.ACTION_REQUESTED]: 'action_requested',
  [MailItemStatus.ARCHIVED]: 'archived',
};

const VIEW_TO_ITEM_STATUS: Record<
  Exclude<MailStatusFilter, 'all'>,
  MailItemStatus
> = {
  new: MailItemStatus.NEW,
  viewed: MailItemStatus.VIEWED,
  scanned: MailItemStatus.SCANNED,
  forwarded: MailItemStatus.FORWARDED,
  action_requested: MailItemStatus.ACTION_REQUESTED,
  archived: MailItemStatus.ARCHIVED,
};

// "New mail" is what the customer hasn't opened yet; an item stays NEW until it
// is viewed. "Pending requests" is the one status that needs the customer to act.
const NEW_MAIL_STATUSES: MailItemStatus[] = [MailItemStatus.NEW];
const PENDING_REQUEST_STATUSES: MailItemStatus[] = [
  MailItemStatus.ACTION_REQUESTED,
];

const liveItem: Prisma.MailItemWhereInput = { deletedAt: null };

/*
 * A request the customer has made that we haven't settled yet. This is what
 * separates "we are waiting on the customer" from "the customer is waiting on
 * us" — both states are stored as ACTION_REQUESTED on the item, so the open
 * request is the only thing that tells them apart (see `hasOpenRequest`).
 */
const openRequest: Prisma.MailRequestWhereInput = {
  deletedAt: null,
  status: {
    in: [PrismaMailRequestStatus.PENDING, PrismaMailRequestStatus.PROCESSING],
  },
};

/*
 * What each of the room's three tabs narrows the SAME list of mail items to.
 *
 * All three render identical rows — an envelope with a sender, a date, and a
 * status — so they are one query with three scopes rather than three shapes:
 *
 *   inbox     everything in the room
 *   requests  items with a forwarding/shredding request still open, which is
 *             exactly the set the customer is waiting on us for
 *   history   items that have been closed out — forwarded, shredded, or the
 *             customer pulled the scan and we logged the disposal
 */
const TAB_SCOPE: Record<MailRoomTab, Prisma.MailItemWhereInput> = {
  inbox: {},
  requests: { requests: { some: openRequest } },
  history: { actions: { some: {} } },
};

// --- Overview ------------------------------------------------------------
export type MailRoomView = {
  id: string;
  name: string;
  address: string;
  status: string;
  newMail: number;
  pendingRequests: number;
  renewsAt: string;
};

export type MailRoomOverview = {
  stats: { totalRooms: number; unreadMail: number; pendingRequests: number };
  rooms: MailRoomView[];
};

export async function getOverview(
  req: Parameters<typeof getAuth>[0],
): Promise<MailRoomOverview> {
  const auth = getAuth(req);

  // A customer sees only their own rooms; the ownership boundary is this where
  // clause, not a per-row check (AGENTS.md: guards are the real boundary).
  const rooms = await prisma.mailRoom.findMany({
    where: { customerId: auth.userId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      items: { where: liveItem, select: { status: true } },
    },
  });

  const views: MailRoomView[] = rooms.map((room) => {
    const newMail = room.items.filter((item) =>
      NEW_MAIL_STATUSES.includes(item.status),
    ).length;
    const pendingRequests = room.items.filter((item) =>
      PENDING_REQUEST_STATUSES.includes(item.status),
    ).length;

    return {
      id: room.id,
      name: room.name,
      address: room.address,
      status: ROOM_STATUS_TO_VIEW[room.status],
      newMail,
      pendingRequests,
      // The card always renders a renewal date; a room without one (still being
      // provisioned) reports its creation date rather than an invalid string.
      renewsAt: (room.renewsAt ?? room.createdAt).toISOString(),
    };
  });

  return {
    stats: {
      totalRooms: views.length,
      unreadMail: views.reduce((sum, room) => sum + room.newMail, 0),
      pendingRequests: views.reduce((sum, room) => sum + room.pendingRequests, 0),
    },
    rooms: views,
  };
}

// --- Room detail ---------------------------------------------------------
export type MailRoomDetail = {
  id: string;
  name: string;
  address: string;
  stats: { newMail: number; pendingRequests: number; totalItems: number };
};

export async function getRoomDetail(
  req: Parameters<typeof getAuth>[0],
  roomId: string,
): Promise<MailRoomDetail> {
  const auth = getAuth(req);

  const room = await prisma.mailRoom.findFirst({
    where: { id: roomId, deletedAt: null },
  });

  // 404 (not 403) for another customer's room, so the id isn't confirmed.
  const found = assertFound(room, auth, (r) => r.customerId);

  const scope: Prisma.MailItemWhereInput = { roomId: found.id, ...liveItem };
  const [totalItems, newMail, pendingRequests] = await Promise.all([
    prisma.mailItem.count({ where: scope }),
    prisma.mailItem.count({ where: { ...scope, status: { in: NEW_MAIL_STATUSES } } }),
    prisma.mailItem.count({
      where: { ...scope, status: { in: PENDING_REQUEST_STATUSES } },
    }),
  ]);

  return {
    id: found.id,
    name: found.name,
    address: found.address,
    stats: { newMail, pendingRequests, totalItems },
  };
}

// --- Items ---------------------------------------------------------------
export type MailItemView = {
  id: string;
  sender: string;
  receivedAt: string;
  storageExpiresAt: string;
  status: string;
  scanReady: boolean;
  note?: string;
  responseDueAt?: string;
  /*
   * True once the customer has asked us to forward or shred this item and we
   * haven't settled it. The item reads as ACTION_REQUESTED either way, so
   * without this the list cannot tell "we need something from you" from "you
   * already told us, we're on it" — and offers the customer a Respond button
   * for a request they themselves submitted.
   */
  hasOpenRequest: boolean;
  // Presigned page images, in order — what the viewer draws inline.
  scanPages?: string[];
  // The item's PDF, when one of the uploaded files was a PDF.
  pdfUrl?: string;
  /*
   * Every uploaded file with its own link, so a scan the viewer cannot draw
   * inline (a PDF among the images) is still reachable one file at a time. The
   * object key is never included — only the short-lived URL.
   */
  files?: {
    name: string;
    contentType: string | null;
    sizeBytes: number | null;
    url: string;
  }[];
};

export type MailItemsPage = {
  items: MailItemView[];
  totalItems: number;
  totalPages: number;
  nextCursor: string | null;
};

// Confirms the room exists and belongs to the caller before any item query runs,
// so an item read can never leak across customers via a guessed room id.
async function assertRoomOwned(
  req: Parameters<typeof getAuth>[0],
  roomId: string,
): Promise<string> {
  const auth = getAuth(req);
  const room = await prisma.mailRoom.findFirst({
    where: { id: roomId, deletedAt: null },
    select: { id: true, customerId: true },
  });

  return assertFound(room, auth, (r) => r.customerId).id;
}

export async function listItems(
  req: Parameters<typeof getAuth>[0],
  roomId: string,
  query: ListMailItemsQuery,
): Promise<MailItemsPage> {
  const ownedRoomId = await assertRoomOwned(req, roomId);

  const where: Prisma.MailItemWhereInput = {
    roomId: ownedRoomId,
    ...liveItem,
    ...TAB_SCOPE[query.tab],
    ...(query.status === 'all'
      ? {}
      : { status: VIEW_TO_ITEM_STATUS[query.status] }),
    ...(query.search
      ? { sender: { contains: query.search, mode: 'insensitive' } }
      : {}),
  };

  const totalItems = await prisma.mailItem.count({ where });

  // Cursor pagination (AGENTS.md): fetch limit+1 to know whether more remain.
  const rows = await prisma.mailItem.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    // One open request is enough to answer `hasOpenRequest` — take(1) keeps this
    // from loading a request history the list never renders.
    include: { requests: { where: openRequest, select: { id: true }, take: 1 } },
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    items: pageRows.map((item) => ({
      id: item.id,
      sender: item.sender,
      receivedAt: item.receivedAt.toISOString(),
      storageExpiresAt: item.storageExpiresAt.toISOString(),
      status: ITEM_STATUS_TO_VIEW[item.status],
      scanReady: item.scanReady,
      note: item.note ?? undefined,
      responseDueAt: item.responseDueAt?.toISOString(),
      hasOpenRequest: item.requests.length > 0,
    })),
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / query.limit)),
    nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null,
  };
}

// One item with its scan pages and PDF as short-TTL presigned URLs, minted here
// after the ownership check above (AGENTS.md, Security & PII). Opening an item
// also marks it read — NEW → VIEWED — which is what drains the "New mail" count.
export async function getItem(
  req: Parameters<typeof getAuth>[0],
  roomId: string,
  itemId: string,
): Promise<MailItemView> {
  const ownedRoomId = await assertRoomOwned(req, roomId);

  const item = await prisma.mailItem.findFirst({
    where: { id: itemId, roomId: ownedRoomId, deletedAt: null },
    include: {
      pages: { orderBy: { pageNumber: 'asc' } },
      requests: { where: openRequest, select: { id: true }, take: 1 },
    },
  });

  if (!item) {
    throw AppError.notFound('Mail item not found');
  }

  // Only an unopened item transitions; updateMany keeps this a no-op (rather than
  // a lost update) when two tabs open the same item at once.
  if (item.status === MailItemStatus.NEW) {
    await prisma.mailItem.updateMany({
      where: { id: item.id, status: MailItemStatus.NEW },
      data: { status: MailItemStatus.VIEWED },
    });
  }

  /*
   * Every uploaded file is presigned once, then split two ways: the images
   * become the inline page strip the viewer draws, and the full list (images and
   * PDFs alike) is returned so nothing an operator attached is unreachable.
   *
   * A file whose signature failed is dropped from both rather than rendered as a
   * broken link — `presignObject` already returns undefined instead of throwing.
   */
  const files = (
    await Promise.all(
      item.pages.map(async (page) => {
        const url = await presignObject(page.objectKey);
        if (!url) return null;

        return {
          name: page.fileName ?? `Page ${page.pageNumber}`,
          contentType: page.contentType,
          sizeBytes: page.sizeBytes,
          url,
        };
      }),
    )
  ).filter((file): file is NonNullable<typeof file> => file !== null);

  // Only images can be drawn inline. A legacy row predating `contentType` has
  // none recorded; those were all page images, so they stay in the strip.
  const scanPages = files
    .filter((file) => !file.contentType || file.contentType.startsWith('image/'))
    .map((file) => file.url);

  return {
    id: item.id,
    sender: item.sender,
    receivedAt: item.receivedAt.toISOString(),
    storageExpiresAt: item.storageExpiresAt.toISOString(),
    // Report the status the customer now sees, not the pre-read one.
    status:
      ITEM_STATUS_TO_VIEW[
        item.status === MailItemStatus.NEW ? MailItemStatus.VIEWED : item.status
      ],
    scanReady: item.scanReady,
    note: item.note ?? undefined,
    responseDueAt: item.responseDueAt?.toISOString(),
    hasOpenRequest: item.requests.length > 0,
    scanPages: scanPages.length > 0 ? scanPages : undefined,
    pdfUrl: await presignObject(item.pdfObjectKey),
    files: files.length > 0 ? files : undefined,
  };
}

// --- Customer-initiated requests -----------------------------------------
/*
 * The write side of the mail room: the "Request forwarding" / "Request
 * shredding" buttons on the item viewer, and the download that closes an item
 * out. Each of these is what puts a row in front of the mail operator — the
 * admin queue has nothing to work without them.
 */

export type MailRequestView = {
  id: string;
  mailItemId: string;
  type: MailRequestType;
  status: string;
  requestedAt: string;
};

const REQUEST_TYPE_TO_PRISMA: Record<MailRequestType, PrismaMailRequestType> = {
  forwarding: PrismaMailRequestType.FORWARDING,
  shredding: PrismaMailRequestType.SHREDDING,
};

/*
 * The one-line address the item forwards to, resolved from the customer's own
 * records rather than accepted from the request. Their company address is the
 * business one they gave us; the room's own address is where the mail already
 * is, so it is not a forwarding destination and is deliberately not used here.
 */
async function forwardingAddress(customerId: string): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: { ownerId: customerId, deletedAt: null },
    select: { address: true },
  });

  return company?.address ?? null;
}

export async function createRequest(
  req: Parameters<typeof getAuth>[0],
  roomId: string,
  itemId: string,
  input: CreateMailRequestInput,
): Promise<MailRequestView> {
  const auth = getAuth(req);
  const ownedRoomId = await assertRoomOwned(req, roomId);

  const item = await prisma.mailItem.findFirst({
    where: { id: itemId, roomId: ownedRoomId, deletedAt: null },
    select: { id: true, status: true, room: { select: { name: true } } },
  });

  if (!item) throw AppError.notFound('Mail item not found');

  // Already dealt with — forwarding a shredded item is not a thing we can do.
  if (
    item.status === MailItemStatus.FORWARDED ||
    item.status === MailItemStatus.ARCHIVED
  ) {
    throw AppError.businessRule('This item has already been handled');
  }

  // One open request per item. Without this a double-tap on the button would put
  // the same envelope in the operator's queue twice.
  const existing = await prisma.mailRequest.findFirst({
    where: {
      mailItemId: item.id,
      deletedAt: null,
      status: { in: [PrismaMailRequestStatus.PENDING, PrismaMailRequestStatus.PROCESSING] },
    },
  });

  if (existing) {
    throw AppError.conflict('A request for this item is already in progress');
  }

  const type = REQUEST_TYPE_TO_PRISMA[input.type];

  const address =
    type === PrismaMailRequestType.FORWARDING
      ? await forwardingAddress(auth.userId)
      : null;

  if (type === PrismaMailRequestType.FORWARDING && !address) {
    throw AppError.businessRule(
      'Add a company address in your account settings before requesting forwarding',
    );
  }

  // One transaction: an item flagged as needing action must always have the
  // request that explains why, and vice versa.
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.mailRequest.create({
      data: {
        mailItemId: item.id,
        customerId: auth.userId,
        type,
        shippingAddress: address,
        notes: input.notes ?? null,
      },
    });

    await tx.mailItem.update({
      where: { id: item.id },
      data: { status: MailItemStatus.ACTION_REQUESTED },
    });

    return created;
  });

  // The mail-ops queue's arrival signal. After the commit, and never able to
  // fail the customer's request.
  void notifyStaffMailRequest({
    requestId: request.id,
    type: input.type,
    roomName: item.room.name,
  });

  return {
    id: request.id,
    mailItemId: request.mailItemId,
    type: input.type,
    status: 'pending',
    requestedAt: request.requestedAt.toISOString(),
  };
}

/*
 * Record that the customer pulled the scan. This is the "Downloaded only" row in
 * the admin mail log — an item nobody asked us to forward or shred, which would
 * otherwise leave no trace of having been dealt with at all.
 *
 * Logged once per item: a customer opening the same PDF three times is one
 * disposal, not three log rows.
 */
export async function recordDownload(
  req: Parameters<typeof getAuth>[0],
  roomId: string,
  itemId: string,
): Promise<{ recorded: boolean }> {
  const auth = getAuth(req);
  const ownedRoomId = await assertRoomOwned(req, roomId);

  const item = await prisma.mailItem.findFirst({
    where: { id: itemId, roomId: ownedRoomId, deletedAt: null },
    select: { id: true, sender: true },
  });

  if (!item) throw AppError.notFound('Mail item not found');

  const already = await prisma.mailActionLog.findFirst({
    where: { mailItemId: item.id, action: MailLogAction.DOWNLOADED },
    select: { id: true },
  });

  if (already) return { recorded: false };

  const customer = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  await prisma.mailActionLog.create({
    data: {
      mailItemId: item.id,
      customerId: auth.userId,
      action: MailLogAction.DOWNLOADED,
      mailItemLabel: item.sender,
      // The customer did it themselves, so there is no staff processor.
      processedByName: customer?.name ?? 'Customer',
    },
  });

  return { recorded: true };
}
