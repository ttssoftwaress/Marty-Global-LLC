import {
  ConversationKind,
  ConversationStatus,
  MessageAuthor,
  Prisma,
  StaffStatus,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { toFirstName, toInitials, toShortName } from '../../../lib/initials.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { canSeeAll } from '../admin.guards.js';
import { iso } from '../admin.views.js';
import type {
  ListConversationsQuery,
  SendMessageInput,
  SupportFilter,
  UpdateConversationInput,
} from './support.validation.js';

/*
 * The admin support inbox — the staff face of the same conversations the portal
 * shows the customer. All Prisma access for these screens lives here.
 *
 * The one asymmetry with `modules/support` is the internal note. It is stored as
 * a message with author INTERNAL_NOTE so the thread stays one chronological
 * stream (which is how the design reads it), and the portal's reads filter that
 * author out. That filter is the only thing keeping a note private, so it is
 * asserted in both directions: the portal excludes it, and nothing here ever
 * writes a note into the customer-visible preview.
 *
 * Message bodies are PII — never logged, here or anywhere (AGENTS.md).
 */

const STATUS_VIEW: Record<ConversationStatus, 'open' | 'pending' | 'resolved'> = {
  [ConversationStatus.OPEN]: 'open',
  [ConversationStatus.PENDING]: 'pending',
  [ConversationStatus.RESOLVED]: 'resolved',
};

const STATUS_LABEL: Record<ConversationStatus, string> = {
  [ConversationStatus.OPEN]: 'Open',
  [ConversationStatus.PENDING]: 'Pending',
  [ConversationStatus.RESOLVED]: 'Resolved',
};

const VIEW_TO_STATUS: Record<string, ConversationStatus> = {
  open: ConversationStatus.OPEN,
  pending: ConversationStatus.PENDING,
  resolved: ConversationStatus.RESOLVED,
};

export type SupportAgent = {
  id: string;
  name: string;
  initials: string;
  shortName: string;
};

function toAgent(user: { id: string; name: string }, shortName?: string | null): SupportAgent {
  return {
    id: user.id,
    name: user.name,
    initials: toInitials(user.name),
    // Snapshotted on the profile where available; derived otherwise, so a member
    // created before the column existed still renders a capsule.
    shortName: shortName ?? toShortName(user.name),
  };
}

function filterWhere(filter: SupportFilter): Prisma.ConversationWhereInput {
  switch (filter) {
    case 'unassigned':
      return { assigneeId: null, status: { not: ConversationStatus.RESOLVED } };
    case 'assigned':
      return { assigneeId: { not: null }, status: { not: ConversationStatus.RESOLVED } };
    case 'resolved':
      return { status: ConversationStatus.RESOLVED };
    case 'all':
      return {};
  }
}

// --- List ----------------------------------------------------------------
export type SupportConversationsPage = {
  conversations: {
    id: string;
    customerName: string;
    customerInitials: string;
    subject: string;
    preview: string;
    lastMessageAt: string;
    unread: boolean;
    status: 'open' | 'pending' | 'resolved';
    assignee: SupportAgent | null;
  }[];
  nextCursor: string | null;
  totalOpen: number;
  totalUnassigned: number;
};

const listInclude = {
  customer: { select: { id: true, name: true } },
  assignee: {
    select: { id: true, name: true, staffProfile: { select: { shortName: true } } },
  },
} satisfies Prisma.ConversationInclude;

/*
 * What this actor sees in the helpdesk queue.
 *
 * Support is scoped differently from every other area, because a helpdesk only
 * works if unclaimed threads are visible to the people who might claim them. So
 * a scoped agent sees their own threads *plus the unassigned pool* — never a
 * colleague's conversations. Narrowing it to `assigneeId: me` alone would leave
 * a new customer message invisible to everyone until an admin hand-assigned it,
 * which is the queue failing at its one job.
 *
 * "All data" on the support row is what opens the colleagues' threads as well.
 *
 * Composed with `AND` rather than spread, because the filter tabs set
 * `assigneeId` themselves — an `OR` sitting beside an `assigneeId` clause would
 * be overwritten by the next spread, and the "Assigned" tab would quietly list
 * every colleague's thread.
 */
async function supportScope(
  actor: AuthContext,
): Promise<Prisma.ConversationWhereInput> {
  if (await canSeeAll(actor, 'support')) return {};

  return {
    AND: [{ OR: [{ assigneeId: actor.userId }, { assigneeId: null }] }],
  };
}

export async function listConversations(
  actor: AuthContext,
  query: ListConversationsQuery,
): Promise<SupportConversationsPage> {
  const scope = await supportScope(actor);

  const where: Prisma.ConversationWhereInput = {
    deletedAt: null,
    // The helpdesk queue is SUPPORT threads only. An order conversation is worked
    // from the order — it belongs to that order's assignee, so surfacing it in a
    // queue any agent can claim would contradict the rule that owns it
    // (modules/conversations).
    kind: ConversationKind.SUPPORT,
    ...scope,
    ...filterWhere(query.filter),
    ...(query.search
      ? {
          OR: [
            { subject: { contains: query.search, mode: 'insensitive' } },
            { preview: { contains: query.search, mode: 'insensitive' } },
            { customer: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const [rows, totalOpen, totalUnassigned] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: listInclude,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
    // Counts over the whole inbox, not the loaded page, so the header pill stays
    // truthful as the list pages in.
    prisma.conversation.count({
      where: {
        deletedAt: null,
        kind: ConversationKind.SUPPORT,
        ...scope,
        status: { not: ConversationStatus.RESOLVED },
      },
    }),
    // Unassigned is the claimable pool, which a scoped agent can see by
    // definition — so this figure needs no scope clause of its own.
    prisma.conversation.count({
      where: {
        deletedAt: null,
        kind: ConversationKind.SUPPORT,
        assigneeId: null,
        status: { not: ConversationStatus.RESOLVED },
      },
    }),
  ]);

  const page = takePage(rows, query.limit);

  /*
   * Staff-side unread is not the customer's `customerReadAt` — that answers a
   * different question. A thread is unread to the team when the newest message
   * came from the customer, which is exactly "waiting on us".
   */
  const newest = await prisma.message.findMany({
    where: {
      conversationId: { in: page.rows.map((row) => row.id) },
      deletedAt: null,
    },
    orderBy: { sentAt: 'desc' },
    select: { conversationId: true, author: true, sentAt: true },
  });

  const latestAuthor = new Map<string, MessageAuthor>();
  for (const message of newest) {
    if (!latestAuthor.has(message.conversationId)) {
      latestAuthor.set(message.conversationId, message.author);
    }
  }

  return {
    conversations: page.rows.map((conversation) => ({
      id: conversation.id,
      customerName: conversation.customer.name,
      customerInitials: toInitials(conversation.customer.name),
      subject: conversation.subject,
      preview: conversation.preview ?? '',
      lastMessageAt: iso(conversation.lastMessageAt ?? conversation.createdAt),
      unread: latestAuthor.get(conversation.id) === MessageAuthor.CUSTOMER,
      status: STATUS_VIEW[conversation.status],
      assignee: conversation.assignee
        ? toAgent(conversation.assignee, conversation.assignee.staffProfile?.shortName)
        : null,
    })),
    nextCursor: page.nextCursor,
    totalOpen,
    totalUnassigned,
  };
}

// --- Thread --------------------------------------------------------------
export type SupportThread = {
  id: string;
  customerName: string;
  customerInitials: string;
  customerFirstName: string;
  subject: string;
  orderReference: string | null;
  orderTo: string | null;
  status: 'open' | 'pending' | 'resolved';
  statusLabel: string;
  assignee: SupportAgent | null;
  assignableAgents: SupportAgent[];
  messages: {
    id: string;
    kind: 'customer' | 'staff' | 'internal_note';
    // Resolved per-viewer rather than stored: the same row is the reading agent's
    // own bubble on one screen and a colleague's on another. `kind` cannot stand
    // in for this — every agent's reply is `staff`, but only one of them is mine.
    mine: boolean;
    authorName: string;
    authorInitials: string;
    body: string;
    sentAt: string;
  }[];
};

const MESSAGE_KIND: Record<MessageAuthor, SupportThread['messages'][number]['kind']> = {
  [MessageAuthor.CUSTOMER]: 'customer',
  [MessageAuthor.AGENT]: 'staff',
  [MessageAuthor.INTERNAL_NOTE]: 'internal_note',
};

// Who a conversation may be handed to: active staff granted the support area.
// Offering anyone else would produce an assignment the guards then refuse.
async function assignableAgents(): Promise<SupportAgent[]> {
  const profiles = await prisma.staffProfile.findMany({
    where: {
      deletedAt: null,
      status: StaffStatus.ACTIVE,
      OR: [{ permissions: { has: 'support' } }, { user: { is: { role: 'admin' } } }],
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  return profiles.map((profile) => toAgent(profile.user, profile.shortName));
}

export async function getThread(
  actor: AuthContext,
  conversationId: string,
): Promise<SupportThread> {
  /*
   * SUPPORT only. This is a security boundary, not tidiness: this module lets any
   * agent with the `support` permission read, reply to, and reassign a thread,
   * which is right for a helpdesk and wrong for an order conversation. Omitting
   * the clause would make these endpoints a way around the assignee lock.
   */
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      kind: ConversationKind.SUPPORT,
      deletedAt: null,
      ...(await supportScope(actor)),
    },
    include: {
      ...listInclude,
      order: { select: { id: true, reference: true } },
      // Staff see every author kind, internal notes included — that is the
      // difference between this thread and the portal's.
      messages: { where: { deletedAt: null }, orderBy: { sentAt: 'asc' } },
    },
  });

  if (!conversation) throw AppError.notFound('Conversation not found');

  const agents = await assignableAgents();

  return {
    id: conversation.id,
    customerName: conversation.customer.name,
    customerInitials: toInitials(conversation.customer.name),
    customerFirstName: toFirstName(conversation.customer.name),
    subject: conversation.subject,
    orderReference: conversation.order?.reference ?? null,
    orderTo: conversation.order ? `/admin/orders/${conversation.order.id}` : null,
    status: STATUS_VIEW[conversation.status],
    statusLabel: STATUS_LABEL[conversation.status],
    assignee: conversation.assignee
      ? toAgent(conversation.assignee, conversation.assignee.staffProfile?.shortName)
      : null,
    assignableAgents: agents,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      kind: MESSAGE_KIND[message.author],
      // The viewer's own messages are the ones they wrote, not the ones from
      // their "side" — a second agent joining a thread sees the first agent's
      // replies as someone else's, which is what keeps the thread honest.
      mine: message.authorUserId === actor.userId,
      authorName:
        message.author === MessageAuthor.CUSTOMER
          ? conversation.customer.name
          : (message.authorName ?? 'Marty Global team'),
      authorInitials: toInitials(
        message.author === MessageAuthor.CUSTOMER
          ? conversation.customer.name
          : message.authorName,
      ),
      body: message.body,
      sentAt: iso(message.sentAt),
    })),
  };
}

// --- Write ---------------------------------------------------------------
/*
 * Post a staff reply or an internal note.
 *
 * The critical rule is the preview: it is what the customer's own Messages list
 * renders, so an internal note must never touch it. Only a reply moves
 * `lastMessageAt`/`preview` — a note is filed into the thread and nothing else.
 */
export async function sendMessage(
  actor: AuthContext,
  conversationId: string,
  input: SendMessageInput,
): Promise<SupportThread['messages'][number]> {
  // SUPPORT only — see getThread. An order thread's replies go through
  // modules/conversations, which checks the assignee first.
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      kind: ConversationKind.SUPPORT,
      deletedAt: null,
      ...(await supportScope(actor)),
    },
    select: { id: true },
  });

  if (!conversation) throw AppError.notFound('Conversation not found');

  const author = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true },
  });

  const isNote = input.kind === 'note';
  const authorName = author?.name ?? 'Marty Global team';
  const sentAt = new Date();

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        author: isNote ? MessageAuthor.INTERNAL_NOTE : MessageAuthor.AGENT,
        authorUserId: actor.userId,
        authorName,
        body: input.body,
        sentAt,
      },
    });

    if (!isNote) {
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: sentAt,
          preview: input.body.slice(0, 160),
          // A reply moves the thread back to the customer.
          status: ConversationStatus.PENDING,
        },
      });
    }

    return created;
  });

  return {
    id: message.id,
    kind: MESSAGE_KIND[message.author],
    // Always the actor's own — this is the row they just wrote.
    mine: true,
    authorName,
    authorInitials: toInitials(authorName),
    body: message.body,
    sentAt: iso(message.sentAt),
  };
}

export async function updateConversation(
  actor: AuthContext,
  conversationId: string,
  input: UpdateConversationInput,
): Promise<SupportThread> {
  // SUPPORT only. Reassignment especially: an order thread's assignee is mirrored
  // from the order and must change with it, never independently from here.
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      kind: ConversationKind.SUPPORT,
      deletedAt: null,
      ...(await supportScope(actor)),
    },
    select: { id: true, status: true, assigneeId: true },
  });

  if (!conversation) throw AppError.notFound('Conversation not found');

  if (input.assigneeId) {
    const agent = await prisma.staffProfile.findFirst({
      where: { userId: input.assigneeId, deletedAt: null, status: StaffStatus.ACTIVE },
      select: { userId: true },
    });

    if (!agent) {
      throw AppError.businessRule(
        'Conversations can only be assigned to an active staff member',
      );
    }
  }

  const nextStatus = input.status ? VIEW_TO_STATUS[input.status] : undefined;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
      ...(nextStatus === ConversationStatus.RESOLVED ? { closedAt: new Date() } : {}),
    },
  });

  if (nextStatus && nextStatus !== conversation.status) {
    void record({
      actor,
      action: AuditAction.CONVERSATION_STATUS_CHANGED,
      entityType: 'Conversation',
      entityId: conversationId,
      metadata: { from: conversation.status, to: nextStatus },
    });
  }

  if (input.assigneeId !== undefined && input.assigneeId !== conversation.assigneeId) {
    void record({
      actor,
      action: AuditAction.CONVERSATION_ASSIGNED,
      entityType: 'Conversation',
      entityId: conversationId,
      metadata: { from: conversation.assigneeId, to: input.assigneeId },
    });
  }

  return getThread(actor, conversationId);
}
