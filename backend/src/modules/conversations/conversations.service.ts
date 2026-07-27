import {
  ConversationKind,
  ConversationStatus,
  MessageAuthor,
  Prisma,
} from '@prisma/client';

import type { AuthContext } from '../../guards/auth-context.js';
import { isStaff } from '../../guards/ownership.js';
import { AppError } from '../../lib/app-error.js';
import { toInitials } from '../../lib/initials.js';
import { prisma } from '../../lib/prisma.js';
import { Role } from '../../lib/roles.js';

/*
 * Order conversations — the thread on an order's detail screen, and the one layer
 * touching Prisma for it (AGENTS.md: services own all logic and all Prisma
 * access; this is also what the socket handler will call, so REST and Socket.io
 * share these guards rather than each growing their own).
 *
 * The rule that defines this module, and the whole reason it is not `support`:
 *
 *   A customer talks to the staff member their order is assigned to. Nobody else.
 *
 * Support is the opposite by design — a customer opens a thread and it routes to
 * whichever agent is free. Both are conversations; only their routing differs, so
 * the routing rule is what lives here and `canStaffParticipate` below is the
 * single place it is decided. Every read and every write funnels through it.
 *
 * Message bodies are PII — never logged, only ids (AGENTS.md, Security & PII).
 */

/*
 * Can this staff member act on this order's conversation?
 *
 * An admin always can: they are the escape hatch when an assignee is away, and
 * the audit trail records who actually spoke. A staff member can only when the
 * order is theirs — this is the assignee lock, and it is enforced here in the
 * service rather than at the route, because the route cannot know the assignee
 * without loading the order first (the same reason ownership checks live in
 * services, per guards/ownership.ts).
 *
 * An unassigned order is answerable by any staff member: replying claims it,
 * which is what `claimIfUnassigned` below does. That keeps a customer who wrote
 * in early from waiting on a queue nobody is watching.
 */
function canStaffParticipate(
  actor: AuthContext,
  order: { assigneeId: string | null },
): boolean {
  if (actor.role === Role.ADMIN) return true;
  if (order.assigneeId === null) return true;
  return order.assigneeId === actor.userId;
}

// A customer may only ever reach their own order's thread; staff reach it subject
// to the lock above. 404 rather than 403 throughout, so an id is never confirmed
// to someone who should not have it (guards/ownership.ts).
function assertParticipant(
  actor: AuthContext,
  order: { customerId: string; assigneeId: string | null },
): void {
  if (isStaff(actor)) {
    if (!canStaffParticipate(actor, order)) {
      throw AppError.notFound('Order not found');
    }
    return;
  }

  if (order.customerId !== actor.userId) {
    throw AppError.notFound('Order not found');
  }
}

// --- Views ---------------------------------------------------------------
export type ConversationMessageView = {
  id: string;
  // `mine` is resolved per-viewer rather than stored: the same row is the
  // customer's own bubble on one screen and the counterparty's on the other.
  kind: 'customer' | 'staff' | 'internal_note';
  mine: boolean;
  authorName: string;
  authorInitials: string;
  body: string;
  sentAt: string;
};

export type OrderConversationView = {
  id: string;
  orderId: string;
  orderReference: string;
  status: 'open' | 'pending' | 'resolved';
  // Who the customer is talking to. Null while the order is unassigned, which is
  // what puts the composer in its read-only state.
  assignee: { id: string; name: string; initials: string } | null;
  /*
   * Whether the viewer may post right now, and the reason when they may not. The
   * backend decides this rather than the client re-deriving it from the assignee:
   * the composer's disabled state and the endpoint's 403 have to agree, and one
   * of them is the real boundary (AGENTS.md, Auth).
   */
  canReply: boolean;
  lockedReason: string | null;
  messages: ConversationMessageView[];
};

const MESSAGE_KIND: Record<MessageAuthor, ConversationMessageView['kind']> = {
  [MessageAuthor.CUSTOMER]: 'customer',
  [MessageAuthor.AGENT]: 'staff',
  [MessageAuthor.INTERNAL_NOTE]: 'internal_note',
};

const STATUS_VIEW: Record<ConversationStatus, OrderConversationView['status']> = {
  [ConversationStatus.OPEN]: 'open',
  [ConversationStatus.PENDING]: 'pending',
  [ConversationStatus.RESOLVED]: 'resolved',
};

/*
 * An internal note is staff-only. The customer's reads filter it out in the
 * query — the rows they may not see never enter this process's memory — and this
 * constant is the single definition of that filter so a new read cannot forget
 * it (the same posture as modules/support).
 */
const CUSTOMER_VISIBLE: Prisma.MessageWhereInput = {
  deletedAt: null,
  author: { in: [MessageAuthor.CUSTOMER, MessageAuthor.AGENT] },
};

const STAFF_VISIBLE: Prisma.MessageWhereInput = { deletedAt: null };

type ConversationRecord = Prisma.ConversationGetPayload<{
  include: {
    assignee: { select: { id: true; name: true } };
    messages: true;
    order: { select: { id: true; reference: true } };
  };
}>;

function toView(
  conversation: ConversationRecord,
  actor: AuthContext,
  customerName: string,
): OrderConversationView {
  const staff = isStaff(actor);
  const assignee = conversation.assignee;

  // Read-only for the customer until someone owns the order, which is the state
  // the panel explains rather than silently disabling itself.
  const locked = !staff && assignee === null;

  return {
    id: conversation.id,
    orderId: conversation.orderId ?? '',
    orderReference: conversation.order?.reference ?? '',
    status: STATUS_VIEW[conversation.status],
    assignee: assignee
      ? { id: assignee.id, name: assignee.name, initials: toInitials(assignee.name) }
      : null,
    canReply: !locked,
    lockedReason: locked
      ? 'A specialist is being assigned to this order. You can reply as soon as they are.'
      : null,
    messages: conversation.messages.map((message) => {
      const fromCustomer = message.author === MessageAuthor.CUSTOMER;
      const authorName = fromCustomer
        ? customerName
        : (message.authorName ?? 'Marty Global team');

      return {
        id: message.id,
        kind: MESSAGE_KIND[message.author],
        // The viewer's own messages are the ones they wrote, not the ones from
        // their "side" — an admin stepping in sees the assignee's replies as
        // someone else's, which is what keeps the thread honest.
        mine: message.authorUserId === actor.userId,
        authorName,
        authorInitials: toInitials(authorName),
        body: message.body,
        sentAt: message.sentAt.toISOString(),
      };
    }),
  };
}

// --- Read ----------------------------------------------------------------
/*
 * The order's conversation, created on first read if it does not exist yet.
 *
 * Lazy creation rather than a row written alongside every order: most orders are
 * never discussed, and an empty thread in the support inbox is noise. The unique
 * index on (orderId, kind) is what makes this safe under concurrency — two
 * simultaneous first-reads race, one loses on the constraint, and the loser reads
 * the winner's row instead of creating a second thread.
 */
export async function getOrderConversation(
  actor: AuthContext,
  orderId: string,
): Promise<OrderConversationView> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: {
      id: true,
      reference: true,
      customerId: true,
      assigneeId: true,
      customer: { select: { name: true } },
    },
  });

  if (!order) throw AppError.notFound('Order not found');

  assertParticipant(actor, order);

  const include = {
    assignee: { select: { id: true, name: true } },
    order: { select: { id: true, reference: true } },
    messages: {
      where: isStaff(actor) ? STAFF_VISIBLE : CUSTOMER_VISIBLE,
      orderBy: { sentAt: 'asc' },
    },
  } satisfies Prisma.ConversationInclude;

  const existing = await prisma.conversation.findFirst({
    where: { orderId: order.id, kind: ConversationKind.ORDER, deletedAt: null },
    include,
  });

  if (existing) {
    return toView(existing as ConversationRecord, actor, order.customer.name);
  }

  const created = await createOrderConversation(order).catch(async (error) => {
    // Lost the create race — the winner's row is the thread.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return prisma.conversation.findFirstOrThrow({
        where: { orderId: order.id, kind: ConversationKind.ORDER, deletedAt: null },
        include,
      });
    }
    throw error;
  });

  return toView(created as ConversationRecord, actor, order.customer.name);
}

function createOrderConversation(order: {
  id: string;
  reference: string;
  customerId: string;
  assigneeId: string | null;
}) {
  return prisma.conversation.create({
    data: {
      customerId: order.customerId,
      orderId: order.id,
      kind: ConversationKind.ORDER,
      // The subject is derived, not asked for: the order is the subject.
      subject: `Order ${order.reference}`,
      // Mirrored from the order so the thread is answerable by the right person
      // from the moment it exists.
      assigneeId: order.assigneeId,
      status: ConversationStatus.OPEN,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      order: { select: { id: true, reference: true } },
      messages: { orderBy: { sentAt: 'asc' } },
    },
  });
}

// --- Write ---------------------------------------------------------------
/*
 * Post into an order's conversation. Persist then emit (AGENTS.md, Live Chat):
 * this writes the row and the thread's denormalised preview in one transaction,
 * and the socket layer calls this same function before emitting, so history
 * survives a reconnect.
 */
export async function sendMessage(
  actor: AuthContext,
  orderId: string,
  input: { body: string; kind?: 'reply' | 'note' },
): Promise<ConversationMessageView> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: {
      id: true,
      reference: true,
      customerId: true,
      assigneeId: true,
      customer: { select: { name: true } },
    },
  });

  if (!order) throw AppError.notFound('Order not found');

  assertParticipant(actor, order);

  const staff = isStaff(actor);

  /*
   * The read-only state is enforced here, not just rendered. A customer whose
   * order has no assignee has nobody to talk to; 422 rather than 403 because the
   * request is well-formed and the caller is entitled to the thread — it is the
   * order's state that makes the message impossible right now.
   */
  if (!staff && order.assigneeId === null) {
    throw AppError.businessRule(
      'This order does not have an assigned specialist yet. You can reply once one is assigned.',
    );
  }

  const conversation = await ensureConversation(order);

  // A note is staff-only; a customer's payload can never produce one, because the
  // customer route parses against a schema that has no `kind` at all.
  const isNote = staff && input.kind === 'note';
  const author = staff
    ? isNote
      ? MessageAuthor.INTERNAL_NOTE
      : MessageAuthor.AGENT
    : MessageAuthor.CUSTOMER;

  const sender = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true },
  });

  const authorName = sender?.name ?? (staff ? 'Marty Global team' : order.customer.name);
  const sentAt = new Date();

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: conversation.id,
        author,
        authorUserId: actor.userId,
        authorName,
        body: input.body,
        sentAt,
      },
    });

    /*
     * An internal note must never touch the preview — the preview is what the
     * customer's own screens render, so writing a note into it would leak the
     * note's first 160 characters to exactly the person it is hidden from. This
     * is the single most important line in the module.
     */
    if (!isNote) {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: sentAt,
          preview: input.body.slice(0, 160),
          // A staff reply puts the ball in the customer's court and vice versa.
          status: staff ? ConversationStatus.PENDING : ConversationStatus.OPEN,
          ...(staff ? {} : { customerReadAt: sentAt }),
          // Replying to an unclaimed order's thread claims it, so the next
          // message has a definite owner and the lock has something to hold.
          ...(staff && conversation.assigneeId === null
            ? { assigneeId: actor.userId }
            : {}),
        },
      });

      if (staff && order.assigneeId === null) {
        await tx.order.update({
          where: { id: order.id },
          data: { assigneeId: actor.userId },
        });
      }
    }

    return created;
  });

  return {
    id: message.id,
    kind: MESSAGE_KIND[message.author],
    mine: true,
    authorName,
    authorInitials: toInitials(authorName),
    body: message.body,
    sentAt: message.sentAt.toISOString(),
  };
}

async function ensureConversation(order: {
  id: string;
  reference: string;
  customerId: string;
  assigneeId: string | null;
}): Promise<{ id: string; assigneeId: string | null }> {
  const existing = await prisma.conversation.findFirst({
    where: { orderId: order.id, kind: ConversationKind.ORDER, deletedAt: null },
    select: { id: true, assigneeId: true },
  });

  if (existing) return existing;

  try {
    const created = await createOrderConversation(order);
    return { id: created.id, assigneeId: created.assigneeId };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return prisma.conversation.findFirstOrThrow({
        where: { orderId: order.id, kind: ConversationKind.ORDER, deletedAt: null },
        select: { id: true, assigneeId: true },
      });
    }
    throw error;
  }
}

// --- Cross-module ---------------------------------------------------------
/*
 * Keep the thread's assignee in step with the order's. Called by the admin orders
 * service when an order is reassigned, so the conversation follows the work:
 * whoever holds the order is who the customer is talking to, which is the rule
 * this whole module exists to enforce.
 *
 * Accepts a transaction client so the reassignment and this update commit
 * together — an order whose assignee disagreed with its thread's would hand the
 * conversation to someone who no longer has the filing.
 */
export async function syncAssignee(
  tx: Prisma.TransactionClient,
  orderId: string,
  assigneeId: string | null,
): Promise<void> {
  await tx.conversation.updateMany({
    where: { orderId, kind: ConversationKind.ORDER, deletedAt: null },
    data: { assigneeId },
  });
}

// The count of order threads waiting on this staff member — messages whose last
// word came from the customer on an order they hold. Drives the admin nav badge.
export async function countAwaitingStaff(userId: string): Promise<number> {
  const conversations = await prisma.conversation.findMany({
    where: {
      kind: ConversationKind.ORDER,
      deletedAt: null,
      assigneeId: userId,
      status: { not: ConversationStatus.RESOLVED },
    },
    select: { id: true },
  });

  if (conversations.length === 0) return 0;

  // "Waiting on us" is the same rule the support inbox uses: the newest message
  // in the thread came from the customer.
  const newest = await prisma.message.findMany({
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      deletedAt: null,
      author: { in: [MessageAuthor.CUSTOMER, MessageAuthor.AGENT] },
    },
    orderBy: { sentAt: 'desc' },
    select: { conversationId: true, author: true },
  });

  const latest = new Map<string, MessageAuthor>();
  for (const message of newest) {
    if (!latest.has(message.conversationId)) {
      latest.set(message.conversationId, message.author);
    }
  }

  return [...latest.values()].filter((author) => author === MessageAuthor.CUSTOMER)
    .length;
}
