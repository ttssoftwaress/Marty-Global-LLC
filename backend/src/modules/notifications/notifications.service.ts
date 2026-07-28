import {
  FeedNotificationCategory,
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { render, toPlainText } from '@react-email/components';

import { sendEmail } from '../../config/ses.js';
import { getAuth } from '../../guards/index.js';
import { enqueueEmail } from '../../jobs/queues.js';
import { AppError } from '../../lib/app-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import type {
  ListFeedQuery,
  NotificationFilter,
  SendEmailInput,
} from './notifications.validation.js';
import { GenericEmail } from './templates/generic-email.js';

// All outbound email flows through here: render → persist → enqueue. Nothing
// sends inline in a request handler (AGENTS.md "Security & PII"), and the
// Notification row is the delivery ledger the processor claims against.

export async function queueEmail(input: SendEmailInput) {
  const element = GenericEmail({
    heading: input.heading,
    body: input.body,
    actionLabel: input.actionLabel,
    actionUrl: input.actionUrl,
  });

  const html = await render(element);
  const text = toPlainText(html);

  const notification = await prisma.notification.create({
    data: {
      channel: NotificationChannel.EMAIL,
      template: input.template,
      recipient: input.to,
      subject: input.subject,
      body: html,
      bodyText: text,
      userId: input.userId,
    },
  });

  await enqueueEmail({ notificationId: notification.id });

  logger.info(
    { notificationId: notification.id, template: input.template },
    'Email queued',
  );

  return notification;
}

export async function getNotification(id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, deletedAt: null },
  });

  if (!notification) {
    throw AppError.notFound('Notification not found');
  }

  return notification;
}

// Called by the job processor. Idempotent by design: a notification already
// marked SENT short-circuits, so a retried or duplicated job never double-sends.
export async function deliverEmail(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    logger.warn({ notificationId }, 'Notification row missing — job dropped');
    return { delivered: false, reason: 'missing' as const };
  }

  if (notification.status === NotificationStatus.SENT) {
    return { delivered: false, reason: 'already-sent' as const };
  }

  if (notification.channel !== NotificationChannel.EMAIL) {
    throw new Error(
      `Notification ${notificationId} is not an email notification`,
    );
  }

  /*
   * Claim the row before handing anything to SES. The status read above is a
   * check, not a claim: a stalled job recovered by BullMQ (or any concurrent
   * retrigger of the same notificationId) would otherwise pass it twice and send
   * the email twice.
   *
   * `attempts` is the claim token — a compare-and-swap against the value we just
   * read. Two workers racing on the same row both match the WHERE, but Postgres
   * serialises them on the row lock and re-checks the predicate for the loser,
   * whose `attempts` no longer matches. Exactly one claim wins, so exactly one
   * send happens. The increment here is the attempt count for this delivery —
   * the success and failure paths below deliberately do not increment again.
   */
  const claim = await prisma.notification.updateMany({
    where: {
      id: notification.id,
      status: { not: NotificationStatus.SENT },
      attempts: notification.attempts,
    },
    data: { attempts: { increment: 1 } },
  });

  if (claim.count === 0) {
    logger.info(
      { notificationId },
      'Notification already claimed by another job — send skipped',
    );
    return { delivered: false, reason: 'already-sent' as const };
  }

  try {
    const providerRef = await sendEmail({
      to: notification.recipient,
      subject: notification.subject ?? '',
      html: notification.body,
      text: notification.bodyText ?? '',
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        providerRef,
        sentAt: new Date(),
        lastError: null,
      },
    });

    logger.info({ notificationId, providerRef }, 'Email sent');

    return { delivered: true, providerRef };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Stay PENDING while BullMQ still has attempts left; markFailed() flips the
    // row to FAILED once the job is permanently exhausted. `attempts` was
    // already incremented by the claim above.
    await prisma.notification.update({
      where: { id: notification.id },
      data: { lastError: message },
    });

    throw error;
  }
}

export async function markFailed(notificationId: string, reason: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, status: NotificationStatus.PENDING },
    data: { status: NotificationStatus.FAILED, lastError: reason },
  });
}

/*
 * --- In-app notification feed -------------------------------------------
 * The `/app/notifications` screen and the top-bar panel. A separate ledger from
 * the email rows above: one event can produce both, but this is what the
 * customer reads in the app.
 *
 * `message` is already display-ready on the row (resolved server-side, amounts
 * formatted), so nothing here re-derives copy. `group` is stamped at read time
 * from the server clock rather than stored — a row's bucket changes as it ages,
 * so persisting it would go stale (schema.prisma).
 */

const FEED_CATEGORY_TO_VIEW: Record<FeedNotificationCategory, string> = {
  [FeedNotificationCategory.ORDER]: 'order',
  [FeedNotificationCategory.BILLING]: 'billing',
  [FeedNotificationCategory.DOCUMENT]: 'document',
  [FeedNotificationCategory.MESSAGE]: 'message',
  [FeedNotificationCategory.PAYMENT]: 'payment',
  [FeedNotificationCategory.MAILROOM]: 'mailroom',
};

// The filter tabs don't map one-to-one onto categories: "Status updates" is the
// whole order/mailroom/payment lifecycle. `all` and `unread` are cross-cutting
// and resolved separately.
const FILTER_CATEGORIES: Record<
  Exclude<NotificationFilter, 'all' | 'unread'>,
  FeedNotificationCategory[]
> = {
  status: [
    FeedNotificationCategory.ORDER,
    FeedNotificationCategory.MAILROOM,
    FeedNotificationCategory.PAYMENT,
  ],
  quotes: [FeedNotificationCategory.BILLING],
  documents: [FeedNotificationCategory.DOCUMENT],
  messages: [FeedNotificationCategory.MESSAGE],
};

export type FeedNotificationView = {
  id: string;
  category: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
  group: 'today' | 'this_week' | 'earlier';
};

export type NotificationFeedPage = {
  notifications: FeedNotificationView[];
  unreadCount: number;
  nextCursor: string | null;
};

// Which divider a row sits under. Stamped from the server clock so grouping
// stays stable across the feed's paginated loads and matches the server's day
// boundary, not the browser's.
function groupOf(createdAt: Date, now: Date): FeedNotificationView['group'] {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  if (createdAt >= startOfToday) return 'today';

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);

  return createdAt >= startOfWeek ? 'this_week' : 'earlier';
}

export async function listFeed(
  req: Parameters<typeof getAuth>[0],
  query: ListFeedQuery,
): Promise<NotificationFeedPage> {
  const auth = getAuth(req);
  const now = new Date();

  // A customer sees only their own feed; the ownership boundary is this where
  // clause, not a per-row check (AGENTS.md: guards are the real boundary).
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

  // The unread count backs the "Unread" tab's pill and the top-bar badge — the
  // total across the feed, not just this page.
  const [unreadCount, rows] = await Promise.all([
    prisma.feedNotification.count({ where: { ...scope, readAt: null } }),
    // Cursor pagination (AGENTS.md): fetch limit+1 to know whether more remain.
    prisma.feedNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    notifications: pageRows.map((row) => ({
      id: row.id,
      category: FEED_CATEGORY_TO_VIEW[row.category],
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
      href: row.href ?? undefined,
      group: groupOf(row.createdAt, now),
    })),
    unreadCount,
    nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null,
  };
}

// Marks the customer's whole feed read — the panel's "Mark all as read". Scoped
// to unread rows so the timestamp reflects when each was actually read.
export async function markAllFeedRead(
  req: Parameters<typeof getAuth>[0],
): Promise<{ unreadCount: number }> {
  const auth = getAuth(req);

  await prisma.feedNotification.updateMany({
    where: { userId: auth.userId, deletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });

  return { unreadCount: 0 };
}

// Marks one row read — the panel's row click, before it navigates to `href`.
// updateMany (not update) so another customer's id silently affects nothing
// rather than throwing a record-not-found that would confirm the id exists.
export async function markFeedItemRead(
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

// The dashboard and top-bar badge read this rather than paging the whole feed.
export async function countUnreadFeed(userId: string): Promise<number> {
  return prisma.feedNotification.count({
    where: { userId, deletedAt: null, readAt: null },
  });
}
