import { FeedNotificationCategory, Prisma } from '@prisma/client';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import type {
  AdminNotificationFilter,
  ListAdminFeedQuery,
} from './notifications.validation.js';

/*
 * The signed-in staff member's own notification feed.
 *
 * It reads the same FeedNotification ledger the customer feed does — the model
 * is keyed on `userId` and a staff member is a User row, so no second table is
 * needed. The scope is therefore identical to the customer's: a member sees the
 * rows addressed to them and nobody else's, which is why this router carries no
 * `requirePermission` (see notifications.routes.ts). A member with no `payments`
 * grant can still be told a payment failed; the link is what the permission
 * guard stops when they follow it.
 *
 * `message` is stored display-ready (resolved when the row is written), so
 * nothing here re-derives copy. `group` is stamped at read time from the server
 * clock rather than stored — a row's bucket changes as it ages.
 */

const CATEGORY_TO_VIEW: Record<FeedNotificationCategory, string> = {
  [FeedNotificationCategory.ORDER]: 'order',
  [FeedNotificationCategory.BILLING]: 'billing',
  [FeedNotificationCategory.DOCUMENT]: 'document',
  [FeedNotificationCategory.MESSAGE]: 'message',
  [FeedNotificationCategory.PAYMENT]: 'payment',
  [FeedNotificationCategory.MAILROOM]: 'mailroom',
};

/*
 * The admin tabs are the work queues a staff member owns, so they don't map one
 * to one onto categories: "Payments" is the money lifecycle (a quote issued and
 * a payment taken are the same concern to whoever works that queue), and
 * "Orders" covers the paperwork attached to an order as well as the order
 * itself. `all` and `unread` are cross-cutting and resolved separately.
 */
const FILTER_CATEGORIES: Record<
  Exclude<AdminNotificationFilter, 'all' | 'unread'>,
  FeedNotificationCategory[]
> = {
  orders: [FeedNotificationCategory.ORDER, FeedNotificationCategory.DOCUMENT],
  payments: [
    FeedNotificationCategory.PAYMENT,
    FeedNotificationCategory.BILLING,
  ],
  support: [FeedNotificationCategory.MESSAGE],
  mailroom: [FeedNotificationCategory.MAILROOM],
};

export type AdminNotificationView = {
  id: string;
  category: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
  group: 'today' | 'this_week' | 'earlier';
};

export type AdminNotificationFeedPage = {
  notifications: AdminNotificationView[];
  unreadCount: number;
  nextCursor: string | null;
};

// Which divider a row sits under. Stamped from the server clock so grouping
// stays stable across the feed's paginated loads and matches the server's day
// boundary, not the browser's.
function groupOf(createdAt: Date, now: Date): AdminNotificationView['group'] {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  if (createdAt >= startOfToday) return 'today';

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);

  return createdAt >= startOfWeek ? 'this_week' : 'earlier';
}

export async function listFeed(
  req: Parameters<typeof getAuth>[0],
  query: ListAdminFeedQuery,
): Promise<AdminNotificationFeedPage> {
  const auth = getAuth(req);
  const now = new Date();

  // The ownership boundary is this where clause, not a per-row check
  // (AGENTS.md: guards are the real boundary).
  const scope: Prisma.FeedNotificationWhereInput = {
    userId: auth.userId,
    deletedAt: null,
  };

  const where: Prisma.FeedNotificationWhereInput = {
    ...scope,
    ...(query.filter === 'all'
      ? {}
      : query.filter === 'unread'
        ? { readAt: null }
        : { category: { in: FILTER_CATEGORIES[query.filter] } }),
  };

  // The unread count backs the "Unread" tab's pill and the top-bar badge — a
  // total across the feed, not just this page.
  const [unreadCount, rows] = await Promise.all([
    prisma.feedNotification.count({ where: { ...scope, readAt: null } }),
    prisma.feedNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    notifications: page.rows.map((row) => ({
      id: row.id,
      category: CATEGORY_TO_VIEW[row.category],
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
      href: row.href ?? undefined,
      group: groupOf(row.createdAt, now),
    })),
    unreadCount,
    nextCursor: page.nextCursor,
  };
}

// The panel's "Mark all as read". Scoped to unread rows so the timestamp
// reflects when each was actually read.
export async function markAllRead(
  req: Parameters<typeof getAuth>[0],
): Promise<{ unreadCount: number }> {
  const auth = getAuth(req);

  await prisma.feedNotification.updateMany({
    where: { userId: auth.userId, deletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });

  return { unreadCount: 0 };
}

// Marks one row read — a row click, before it navigates to `href`. updateMany
// (not update) so another user's id silently affects nothing rather than
// throwing a record-not-found that would confirm the id exists.
export async function markRead(
  req: Parameters<typeof getAuth>[0],
  id: string,
): Promise<{ id: string; read: true }> {
  const auth = getAuth(req);

  const result = await prisma.feedNotification.updateMany({
    where: { id, userId: auth.userId, deletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });

  // Nothing updated means either the row is already read or it isn't theirs; an
  // already-read row is a no-op success, so only a genuinely missing row 404s.
  if (result.count === 0) {
    const exists = await prisma.feedNotification.findFirst({
      where: { id, userId: auth.userId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw AppError.notFound('Notification not found');
  }

  return { id, read: true };
}
