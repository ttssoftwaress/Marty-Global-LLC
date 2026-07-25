import { MailItemStatus, MailRoomStatus, Prisma } from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { assertFound } from '../../guards/ownership.js';
import { AppError } from '../../lib/app-error.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject, presignObjects } from '../../lib/storage.js';
import type {
  ListMailItemsQuery,
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
  scanPages?: string[];
  pdfUrl?: string;
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

  // Requests and history are placeholder views in the design — they have no rows
  // of their own yet, so they resolve to an empty page instead of listing the
  // inbox under a different heading.
  if (query.tab !== 'inbox') {
    return { items: [], totalItems: 0, totalPages: 1, nextCursor: null };
  }

  const where: Prisma.MailItemWhereInput = {
    roomId: ownedRoomId,
    ...liveItem,
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
    include: { pages: { orderBy: { pageNumber: 'asc' } } },
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

  const scanPages = presignObjects(item.pages.map((page) => page.objectKey));

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
    scanPages: scanPages.length > 0 ? scanPages : undefined,
    pdfUrl: presignObject(item.pdfObjectKey),
  };
}
