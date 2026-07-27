import {
  FeedNotificationCategory,
  MailItemStatus,
  OrderStatus,
} from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { prisma } from '../../lib/prisma.js';
import { getBillingSummary, type Money } from '../billing/billing.service.js';
import { countUnreadConversations } from '../support/support.service.js';

/*
 * The portal dashboard — the customer's home screen. This module composes; it
 * owns no records of its own. Figures that also appear on another screen are
 * read through that module's service (billing's summary, support's unread
 * count), so the dashboard can never disagree with the page it links to.
 */

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

// "Active" is anything in flight — the same set the My-Orders `active` tab uses.
const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.SUBMITTED,
  OrderStatus.UNDER_REVIEW,
  OrderStatus.MISSING_INFO,
  OrderStatus.APPROVED,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
];

// The feed row's category picks the activity icon and tint; the dashboard's set
// is narrower than the feed's, so several categories share a glyph.
const CATEGORY_TO_ICON: Record<
  FeedNotificationCategory,
  'order' | 'mail' | 'payment' | 'alert'
> = {
  [FeedNotificationCategory.ORDER]: 'order',
  [FeedNotificationCategory.BILLING]: 'payment',
  [FeedNotificationCategory.PAYMENT]: 'payment',
  [FeedNotificationCategory.MAILROOM]: 'mail',
  [FeedNotificationCategory.DOCUMENT]: 'alert',
  [FeedNotificationCategory.MESSAGE]: 'order',
};

const CATEGORY_TO_TONE: Record<
  FeedNotificationCategory,
  'info' | 'success' | 'alert'
> = {
  [FeedNotificationCategory.ORDER]: 'info',
  [FeedNotificationCategory.BILLING]: 'alert',
  [FeedNotificationCategory.PAYMENT]: 'success',
  [FeedNotificationCategory.MAILROOM]: 'info',
  [FeedNotificationCategory.DOCUMENT]: 'alert',
  [FeedNotificationCategory.MESSAGE]: 'info',
};

export type DashboardSummary = {
  customerFirstName: string;
  accountStatus: 'active' | 'action_required' | 'suspended';
  metrics: {
    activeOrders: number;
    amountDue: Money;
    unreadMail: number;
    pendingMessages: number;
  };
  recentOrders: {
    id: string;
    reference: string;
    serviceName: string;
    submittedAt: string;
    status: string;
  }[];
  recentActivity: {
    id: string;
    tone: 'info' | 'success' | 'alert';
    icon: 'order' | 'mail' | 'payment' | 'alert';
    message: { text: string; emphasis?: boolean }[];
    occurredAt: string;
    action?: { label: string; to: string };
  }[];
  billing: { amountDue: Money; totalPaid: Money; pendingQuotes: number };
  mailRooms: { totalRooms: number; unreadMail: number; pendingRequests: number };
};

const RECENT_ORDERS_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 5;

export async function getSummary(
  req: Parameters<typeof getAuth>[0],
): Promise<DashboardSummary> {
  const auth = getAuth(req);
  const userId = auth.userId;

  // Everything is scoped to the signed-in customer; the ownership boundary is
  // these where clauses (AGENTS.md: guards are the real boundary).
  const [
    user,
    activeOrders,
    attentionOrders,
    recentOrders,
    billing,
    pendingMessages,
    rooms,
    activity,
  ] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true, banned: true },
    }),
    prisma.order.count({
      where: { customerId: userId, deletedAt: null, status: { in: ACTIVE_STATUSES } },
    }),
    prisma.order.count({
      where: { customerId: userId, deletedAt: null, status: OrderStatus.MISSING_INFO },
    }),
    prisma.order.findMany({
      where: { customerId: userId, deletedAt: null },
      include: { items: { select: { serviceName: true, sortOrder: true } } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ORDERS_LIMIT,
    }),
    getBillingSummary(userId),
    countUnreadConversations(userId),
    prisma.mailRoom.findMany({
      where: { customerId: userId, deletedAt: null },
      include: {
        items: { where: { deletedAt: null }, select: { status: true } },
      },
    }),
    prisma.feedNotification.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ACTIVITY_LIMIT,
    }),
  ]);

  // Mail-room counts are derived from the item rows, never stored — the same
  // rule the mailroom module follows (schema.prisma).
  const unreadMail = rooms.reduce(
    (sum, room) =>
      sum + room.items.filter((item) => item.status === MailItemStatus.NEW).length,
    0,
  );
  const pendingRequests = rooms.reduce(
    (sum, room) =>
      sum +
      room.items.filter((item) => item.status === MailItemStatus.ACTION_REQUESTED)
        .length,
    0,
  );

  return {
    customerFirstName: firstNameOf(user?.name ?? ''),
    // A banned account reads as suspended; anything the customer must act on —
    // an order missing info, or mail awaiting a response — raises the banner.
    accountStatus: user?.banned
      ? 'suspended'
      : attentionOrders > 0 || pendingRequests > 0
        ? 'action_required'
        : 'active',
    metrics: {
      activeOrders,
      amountDue: billing.amountDue,
      unreadMail,
      pendingMessages,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      reference: order.reference,
      serviceName: summarizeServiceName(order.items),
      submittedAt: (order.submittedAt ?? order.createdAt).toISOString(),
      status: STATUS_TO_VIEW[order.status],
    })),
    // The feed row's message is already display-ready (resolved server-side), so
    // it becomes a single unemphasised segment rather than being re-parsed for
    // markup — the segment shape stays available for richer rows later.
    recentActivity: activity.map((row) => ({
      id: row.id,
      tone: CATEGORY_TO_TONE[row.category],
      icon: CATEGORY_TO_ICON[row.category],
      message: [{ text: row.message }],
      occurredAt: row.createdAt.toISOString(),
      action: row.href ? { label: 'View', to: row.href } : undefined,
    })),
    billing,
    mailRooms: { totalRooms: rooms.length, unreadMail, pendingRequests },
  };
}

// The list line shows one service name per order; an order can hold several, so
// summarize as "First service +N" — the same rule the orders module uses.
function summarizeServiceName(
  items: { serviceName: string; sortOrder: number }[],
): string {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const first = sorted[0];
  if (!first) return 'Order';
  const extra = sorted.length - 1;
  return extra > 0 ? `${first.serviceName} +${extra}` : first.serviceName;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
