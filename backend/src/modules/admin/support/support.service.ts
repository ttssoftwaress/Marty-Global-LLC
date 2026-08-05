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
import { presignObject } from '../../../lib/storage.js';
import {
  emitConversationChanged,
  evictFromConversation,
} from '../../../sockets/broadcast.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { isSeen } from '../../support/support.service.js';
import { canSeeAll, hasPermission } from '../admin.guards.js';
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
    case 'open':
      return { status: ConversationStatus.OPEN };
    case 'pending':
      return { status: ConversationStatus.PENDING };
    case 'resolved':
      return { status: ConversationStatus.RESOLVED };
    case 'all':
      return {};
  }
}

/*
 * Which filter tabs this actor is offered, and what each is called.
 *
 * Published by the API rather than hardcoded in the browser, for the same reason
 * the permission areas are: who sees which cohorts is an authorization question,
 * and answering it in the frontend would make the tab strip a claim the endpoint
 * had not agreed to.
 *
 * A supervisor gets the queue-wide cohorts; an agent, whose inbox is by
 * definition the chats assigned to them, gets the workflow states instead —
 * "Unassigned" would always be empty for them and "Assigned" identical to "All".
 */
const SUPERVISOR_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'resolved', label: 'Resolved' },
] as const;

const AGENT_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export type SupportFilterOption = { value: SupportFilter; label: string };

// --- List ----------------------------------------------------------------
export type SupportConversationsPage = {
  conversations: {
    id: string;
    customerName: string;
    customerInitials: string;
    // A website visitor rather than an account holder. The row badges it, and it
    // is why no customer link is offered.
    isGuest: boolean;
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
  /*
   * How much of the queue this actor is looking at, and what they may do to it.
   * Both are backend decisions sent down with the page, for the same reason the
   * orders queue sends its scope: "12 open" and "12 open assigned to you" are the
   * same figure meaning very different things, and the rule separating them lives
   * here (AGENTS.md, Auth).
   */
  scope: 'all' | 'assigned';
  canAssign: boolean;
  // Which cohorts the filter strip offers. See SUPERVISOR_FILTERS / AGENT_FILTERS.
  filters: SupportFilterOption[];
};

const listInclude = {
  customer: { select: { id: true, name: true } },
  // A thread opened from the marketing site has no account behind it. It is the
  // same kind of help request, routed the same way, so it belongs in this queue —
  // only the identity on it differs (modules/guest).
  guest: { select: { id: true, name: true, email: true } },
  assignee: {
    select: { id: true, name: true, staffProfile: { select: { shortName: true } } },
  },
} satisfies Prisma.ConversationInclude;

export type ConversationParty = {
  name: string;
  // False for a website visitor, which is what the inbox badges and what tells
  // the UI there is no customer record to link through to.
  registered: boolean;
};

/*
 * Who the team is talking to.
 *
 * Exactly one of the two is set (schema.prisma enforces it), but the fallback is
 * not dead code: a purged guest leaves the conversation behind for a moment
 * before the cascade completes, and an agent's inbox should not blow up on it.
 */
function partyOf(conversation: {
  customer: { name: string } | null;
  guest: { name: string } | null;
}): ConversationParty {
  if (conversation.customer) {
    return { name: conversation.customer.name, registered: true };
  }
  return { name: conversation.guest?.name ?? 'Website visitor', registered: false };
}

/*
 * What this actor sees in the helpdesk queue.
 *
 * An agent sees the chats assigned to them and nothing else — not a colleague's,
 * and not one nobody owns yet. That is only a workable helpdesk because incoming
 * chats are routed automatically as they arrive
 * (modules/support/support.assignment.ts): there is no unclaimed pool left to be
 * visible to, and a thread that somehow has no owner is picked up by the safety
 * net on the customer's next message.
 *
 * "All data" on the support row — or `support.assign`, which needs the same view
 * to distribute work — is what opens the colleagues' threads.
 *
 * Composed with `AND` rather than spread, because the filter tabs set
 * `assigneeId` themselves: a bare `assigneeId` here would be overwritten by the
 * next spread, and the "Unassigned" tab would quietly list every colleague's
 * thread.
 */
async function supportScope(
  actor: AuthContext,
): Promise<Prisma.ConversationWhereInput> {
  if (await canSeeAll(actor, 'support')) return {};

  return { AND: [{ assigneeId: actor.userId }] };
}

/*
 * Chats still waiting for an owner: nobody has picked them up and they are not
 * closed.
 *
 * One definition, three readers — the inbox header's pill, the sidebar badge,
 * and the live push behind it — because a badge that disagreed with the number
 * printed at the top of the screen it links to is worse than no badge.
 *
 * Scoped like every other read here, which for an ordinary agent means zero by
 * construction: their inbox is the threads assigned to them, so "unassigned" is
 * not a cohort they have. A supervisor sees the real figure, and with automatic
 * routing a non-zero one is worth acting on — it means the team has no eligible
 * support agent for the router to hand the chat to.
 *
 * The scope goes under `AND` rather than being spread, so that whatever fields
 * it carries cannot be silently dropped by the fixed predicates below it — an
 * `assigneeId` from the scope spread here would be overwritten by the
 * `assigneeId: null` this filter exists to apply, widening the count to every
 * unowned thread in the system.
 */
function unattendedWhere(
  scope: Prisma.ConversationWhereInput,
): Prisma.ConversationWhereInput {
  return {
    AND: [
      scope,
      {
        deletedAt: null,
        kind: ConversationKind.SUPPORT,
        assigneeId: null,
        status: { not: ConversationStatus.RESOLVED },
      },
    ],
  };
}

/*
 * The sidebar badge's number, on its own so the shell can read it on every
 * `/admin/*` screen without loading a page of the inbox.
 *
 * It falls to zero the moment a chat is assigned — which is the whole point of
 * the bubble: it counts work nobody has taken, not work outstanding.
 */
export async function countUnattended(actor: AuthContext): Promise<number> {
  return prisma.conversation.count({
    where: unattendedWhere(await supportScope(actor)),
  });
}

export async function listConversations(
  actor: AuthContext,
  query: ListConversationsQuery,
): Promise<SupportConversationsPage> {
  const [scope, seesAll, canAssign] = await Promise.all([
    supportScope(actor),
    canSeeAll(actor, 'support'),
    hasPermission(actor, 'support.assign'),
  ]);

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
    // The same figure the sidebar badge carries — see `unattendedWhere`.
    prisma.conversation.count({ where: unattendedWhere(scope) }),
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
    conversations: page.rows.map((conversation) => {
      const party = partyOf(conversation);

      return {
        id: conversation.id,
        customerName: party.name,
        customerInitials: toInitials(party.name),
        isGuest: !party.registered,
        subject: conversation.subject,
        preview: conversation.preview ?? '',
        lastMessageAt: iso(conversation.lastMessageAt ?? conversation.createdAt),
        unread: latestAuthor.get(conversation.id) === MessageAuthor.CUSTOMER,
        status: STATUS_VIEW[conversation.status],
        assignee: conversation.assignee
          ? toAgent(conversation.assignee, conversation.assignee.staffProfile?.shortName)
          : null,
      };
    }),
    nextCursor: page.nextCursor,
    totalOpen,
    totalUnassigned,
    scope: seesAll ? 'all' : 'assigned',
    canAssign,
    filters: [...(seesAll ? SUPERVISOR_FILTERS : AGENT_FILTERS)],
  };
}

// --- Thread --------------------------------------------------------------
export type SupportThread = {
  id: string;
  customerName: string;
  customerInitials: string;
  customerFirstName: string;
  // A website visitor with no account. The header shows the email they gave
  // instead of a link to a customer record that does not exist.
  isGuest: boolean;
  guestEmail: string | null;
  subject: string;
  orderReference: string | null;
  orderTo: string | null;
  status: 'open' | 'pending' | 'resolved';
  statusLabel: string;
  assignee: SupportAgent | null;
  /*
   * Who this thread could be handed to — empty for an agent, who may not hand it
   * to anyone. Sent alongside `canAssign` rather than instead of it, so the UI can
   * draw the difference between "nobody to assign to" and "not by you".
   */
  assignableAgents: SupportAgent[];
  /*
   * Whether this actor may reassign the thread (`support.assign`). Incoming chats
   * are routed automatically and evenly, so overriding that routing is a rota
   * decision — the exact mirror of `orders.assign` on an order.
   *
   * The backend decides it, because the disabled control and the endpoint's
   * refusal have to agree and the endpoint is the real boundary (AGENTS.md, Auth).
   */
  canAssign: boolean;
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
    // Whether the customer has read this reply. Only set on staff replies — a
    // tick under the customer's own message would be telling the agent about the
    // agent's reading. Undefined on an internal note, which has no other side.
    seen?: boolean;
    /*
     * Files the customer sent with the message.
     *
     * `href` is a short-TTL presigned link minted on this read, exactly as the
     * portal mints one for the customer — the same object, signed again for
     * whoever is looking at it now. Undefined when R2 is unconfigured or the
     * signature failed, which the chip renders as a name with no link rather than
     * a dead href.
     */
    attachments?: { id: string; name: string; size: number; href?: string }[];
  }[];
};

type MessageWithAttachments = Prisma.MessageGetPayload<{
  include: { attachments: true };
}>;

async function toAttachments(
  message: MessageWithAttachments,
): Promise<SupportThread['messages'][number]['attachments']> {
  if (message.attachments.length === 0) return undefined;

  return Promise.all(
    message.attachments.map(async (attachment) => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.sizeBytes,
      href: await presignObject(attachment.objectKey),
    })),
  );
}

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
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: 'asc' },
        // Without this the files a customer sent in are invisible to the agent
        // answering them — the socket delivers one that arrives while the thread
        // is open, and nothing brings it back on the next load.
        include: { attachments: true },
      },
    },
  });

  if (!conversation) throw AppError.notFound('Conversation not found');

  // The staff list is only loaded for someone who may actually use it — offering
  // a menu the endpoint would refuse is worse than not offering one.
  const canAssign = await hasPermission(actor, 'support.assign');
  const agents = canAssign ? await assignableAgents() : [];
  const party = partyOf(conversation);

  return {
    id: conversation.id,
    customerName: party.name,
    customerInitials: toInitials(party.name),
    customerFirstName: toFirstName(party.name),
    isGuest: !party.registered,
    guestEmail: conversation.guest?.email ?? null,
    subject: conversation.subject,
    orderReference: conversation.order?.reference ?? null,
    orderTo: conversation.order ? `/admin/orders/${conversation.order.id}` : null,
    status: STATUS_VIEW[conversation.status],
    statusLabel: STATUS_LABEL[conversation.status],
    assignee: conversation.assignee
      ? toAgent(conversation.assignee, conversation.assignee.staffProfile?.shortName)
      : null,
    assignableAgents: agents,
    canAssign,
    messages: await Promise.all(
      conversation.messages.map(async (message) => ({
        id: message.id,
        kind: MESSAGE_KIND[message.author],
        // The viewer's own messages are the ones they wrote, not the ones from
        // their "side" — a second agent joining a thread sees the first agent's
        // replies as someone else's, which is what keeps the thread honest.
        mine: message.authorUserId === actor.userId,
        authorName:
          message.author === MessageAuthor.CUSTOMER
            ? party.name
            : (message.authorName ?? 'Marty Global team'),
        authorInitials: toInitials(
          message.author === MessageAuthor.CUSTOMER ? party.name : message.authorName,
        ),
        body: message.body,
        sentAt: iso(message.sentAt),
        seen:
          message.author === MessageAuthor.AGENT
            ? isSeen(message.sentAt, conversation.customerReadAt)
            : undefined,
        attachments: await toAttachments(message),
      })),
    ),
  };
}

/*
 * Mark the team's side of a thread read.
 *
 * Called when an agent opens the conversation and by the socket when one arrives
 * while it is already on screen. `updateMany` with the same scope clause as the
 * read above, so an agent who may not see the thread silently updates nothing
 * rather than moving a marker on a conversation they cannot open.
 */
export async function markStaffRead(
  actor: AuthContext,
  conversationId: string,
): Promise<{ conversationId: string; readAt: string }> {
  const readAt = new Date();

  await prisma.conversation.updateMany({
    where: {
      id: conversationId,
      kind: ConversationKind.SUPPORT,
      deletedAt: null,
      ...(await supportScope(actor)),
    },
    data: { staffReadAt: readAt },
  });

  return { conversationId, readAt: readAt.toISOString() };
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
    select: { id: true, guestId: true, assigneeId: true },
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
          // Writing a reply means having read what it answers.
          staffReadAt: sentAt,
        },
      });

      /*
       * A guest thread's retention window tracks the CONVERSATION, not the
       * visitor's own activity — otherwise a thread the team is actively
       * answering could be purged out from under them while the visitor sleeps.
       */
      if (conversation.guestId) {
        await tx.guestVisitor.update({
          where: { id: conversation.guestId },
          data: { lastSeenAt: sentAt },
        });
      }
    }

    return created;
  });

  /*
   * A reply changed the row the inbox renders — preview, time, status — so the
   * list is told. A note changed none of them, by design, so it is not.
   *
   * Emitted from the service rather than the socket handler because a reply
   * arrives on either transport, and an event sent from only one of them would be
   * a live inbox that quietly stops updating whenever a connection drops.
   */
  if (!isNote) {
    emitConversationChanged({
      conversationId,
      assigneeId: conversation.assigneeId,
    });
  }

  return {
    id: message.id,
    kind: MESSAGE_KIND[message.author],
    // Always the actor's own — this is the row they just wrote.
    mine: true,
    authorName,
    authorInitials: toInitials(authorName),
    body: message.body,
    sentAt: iso(message.sentAt),
    // Nobody has read a message that was written a moment ago.
    seen: isNote ? undefined : false,
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

  const reassigning =
    input.assigneeId !== undefined && input.assigneeId !== conversation.assigneeId;

  /*
   * Handing a chat to someone else is its own grant. An agent works the chats
   * routed to them — reply, note, status — and may not push one onto a colleague
   * or pull one off them; that is a rota decision, and the router already spreads
   * the load evenly without anyone's help.
   *
   * Checked on the change rather than on the field, so a client re-submitting the
   * current assignee alongside a status change is not refused for a write it is
   * not making.
   */
  if (reassigning && !(await hasPermission(actor, 'support.assign'))) {
    throw AppError.unauthorized(
      'Only a supervisor can reassign a conversation',
    );
  }

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
      // Stamped on a manual move too, so the router's rotation counts a chat an
      // admin handed over exactly as it counts one it routed itself.
      ...(reassigning ? { assignedAt: input.assigneeId ? new Date() : null } : {}),
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

  if (reassigning) {
    void record({
      actor,
      action: AuditAction.CONVERSATION_ASSIGNED,
      entityType: 'Conversation',
      entityId: conversationId,
      metadata: { from: conversation.assigneeId, to: input.assigneeId },
    });

    /*
     * The thread has left one desk and landed on another. Both have to be told,
     * and the previous owner's live connection has to stop receiving it — a
     * socket already in the room stays there until something turns it out
     * (sockets/broadcast.ts).
     *
     * The new assignee sees the whole history the moment they open it: nothing
     * about a message is scoped to who was assigned when, so a reassignment hands
     * over the conversation rather than a slice of it.
     */
    if (conversation.assigneeId) {
      evictFromConversation(conversationId, conversation.assigneeId);
    }
  }

  if (reassigning || nextStatus) {
    emitConversationChanged({
      conversationId,
      // Not `??` — unassigning sends an explicit null, which a nullish fallback
      // would read as "unchanged" and quietly re-broadcast the old owner.
      assigneeId:
        input.assigneeId === undefined ? conversation.assigneeId : input.assigneeId,
      previousAssigneeId: reassigning ? conversation.assigneeId : null,
    });
  }

  return getThread(actor, conversationId);
}
