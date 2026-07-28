import { ConversationKind, ConversationStatus, StaffStatus } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { Role } from '../../lib/roles.js';
import { availableAgentIds } from '../../sockets/presence.js';
import { AuditAction, record } from '../audit/audit.service.js';

/*
 * Who answers an incoming chat.
 *
 * Every support thread is routed to an agent the moment it is created, from
 * whichever surface opened it — the portal's Messages screen or the marketing
 * site's chat bubble. There is no unclaimed pool any more: an agent's inbox is
 * exactly the threads assigned to them, so a chat nobody owns is a chat nobody
 * sees.
 *
 * The rule, in order:
 *
 *   1. Eligible = an ACTIVE StaffProfile holding the `support` area, whose auth
 *      role is `staff`. Admins and operations managers are deliberately out of
 *      the rotation — they supervise the queue and can still take a thread by
 *      hand, but handing them customer chats automatically would put work on the
 *      people meant to be distributing it.
 *   2. Prefer the agents who are connected AND have not marked themselves Away.
 *      Only if none of them is around does the whole eligible set come back into
 *      play, so a chat that arrives overnight still lands on a desk.
 *   3. Within the chosen tier, fewest OPEN threads wins — that is the load the
 *      agent is actually carrying, not their lifetime total.
 *   4. Ties break on who has waited longest since their last assignment, which
 *      is what turns "balanced" into a rotation. A null `assignedAt` (an agent
 *      who has never been given a chat) sorts first.
 *
 * The pick is a read followed by a write and is not serialised: two chats
 * arriving in the same instant can both see the same load figures and land on
 * the same agent. That is a one-thread skew the next assignment corrects, and
 * the alternative — locking the whole staff table on every inbound message — is
 * a far worse trade for a helpdesk queue.
 */

export type AssignmentOutcome = {
  assigneeId: string | null;
  assignedAt: Date | null;
};

const UNASSIGNED: AssignmentOutcome = { assigneeId: null, assignedAt: null };

export type Candidate = {
  userId: string;
  // What the agent is carrying right now: threads assigned to them that are not
  // resolved. Not a lifetime total — an agent who has closed a hundred chats is
  // not busy.
  openThreads: number;
  lastAssignedAt: Date | null;
};

async function eligibleAgentIds(): Promise<string[]> {
  const profiles = await prisma.staffProfile.findMany({
    where: {
      deletedAt: null,
      // A deactivated member keeps their session until it expires; the profile
      // status is what actually takes them out of the rotation.
      status: StaffStatus.ACTIVE,
      permissions: { has: 'support' },
      // Rule 1: the rotation is for staff, not for the people overseeing it.
      user: { is: { role: Role.STAFF } },
    },
    select: { userId: true },
  });

  return profiles.map((profile) => profile.userId);
}

/*
 * Load and recency for each candidate, in two grouped reads rather than a query
 * per agent — the router runs on the inbound-message path and a team of twenty
 * would otherwise be twenty round trips before the customer's first message is
 * even stored.
 *
 * They are separate groupings because they ask different questions: load counts
 * only threads still open, while "when were you last given something" has to
 * span resolved threads too — an agent who cleared their queue an hour ago has
 * not been waiting since their oldest unresolved chat.
 */
export async function loadFor(candidateIds: string[]): Promise<Candidate[]> {
  const [openLoad, lastAssigned] = await Promise.all([
    prisma.conversation.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: candidateIds },
        kind: ConversationKind.SUPPORT,
        deletedAt: null,
        status: { not: ConversationStatus.RESOLVED },
      },
      _count: { _all: true },
    }),
    prisma.conversation.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: candidateIds },
        kind: ConversationKind.SUPPORT,
        deletedAt: null,
      },
      _max: { assignedAt: true },
    }),
  ]);

  const loadByAgent = new Map(
    openLoad.map((row) => [row.assigneeId, row._count._all]),
  );
  const recencyByAgent = new Map(
    lastAssigned.map((row) => [row.assigneeId, row._max.assignedAt]),
  );

  return candidateIds.map((userId) => ({
    userId,
    openThreads: loadByAgent.get(userId) ?? 0,
    lastAssignedAt: recencyByAgent.get(userId) ?? null,
  }));
}

// Rules 3 and 4. The userId tie-break is not a preference, only a guarantee that
// the ordering is total — two agents with identical figures must not depend on
// the order Postgres happened to return them in.
function leastLoaded(candidates: Candidate[]): Candidate | undefined {
  return [...candidates].sort((a, b) => {
    if (a.openThreads !== b.openThreads) return a.openThreads - b.openThreads;

    const aTime = a.lastAssignedAt?.getTime() ?? 0;
    const bTime = b.lastAssignedAt?.getTime() ?? 0;
    if (aTime !== bTime) return aTime - bTime;

    return a.userId < b.userId ? -1 : 1;
  })[0];
}

/*
 * Rules 2 through 4 — the choice itself, once the candidates and their figures
 * are known.
 *
 * Pure and exported, because this is where the whole routing policy lives and it
 * is the part worth pinning down: the two reads around it are ordinary queries,
 * but "who gets the next chat" is a decision with four interacting rules and no
 * obvious right answer to fall back on when one of them regresses.
 */
export function chooseAgent(
  candidates: Candidate[],
  online: ReadonlySet<string>,
): Candidate | undefined {
  const preferred = candidates.filter((candidate) => online.has(candidate.userId));

  return leastLoaded(preferred.length > 0 ? preferred : candidates);
}

/*
 * Choose the agent for a new chat. Returns a null assignee when the team has
 * nobody eligible — the thread then sits unassigned, visible to whoever holds
 * `support.all` or `support.assign`, which is the correct place for a chat that
 * arrived with no support agent configured to take it.
 */
export async function pickAssignee(): Promise<AssignmentOutcome> {
  const candidateIds = await eligibleAgentIds();
  if (candidateIds.length === 0) return UNASSIGNED;

  // Presence is in-memory and process-local (sockets/presence.ts), which is
  // exactly right here: "who can pick this up right now" is a question about this
  // instant and nothing else.
  const chosen = chooseAgent(await loadFor(candidateIds), availableAgentIds());
  if (!chosen) return UNASSIGNED;

  return { assigneeId: chosen.userId, assignedAt: new Date() };
}

/*
 * The safety net: give an unassigned thread an owner.
 *
 * Called when a customer writes into a conversation that has no assignee —
 * either because it predates automatic routing, or because its agent's account
 * was removed and the relation set itself null. Without it those threads would
 * be invisible to every agent and would sit unanswered until an admin noticed.
 *
 * The `assigneeId: null` clause in the update is what makes it safe to call on
 * every inbound message: it is a compare-and-set, so a thread that gained an
 * owner between the read and the write keeps the owner it has rather than being
 * quietly moved off them.
 */
export async function ensureAssigned(conversationId: string): Promise<string | null> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      kind: ConversationKind.SUPPORT,
      deletedAt: null,
      assigneeId: null,
    },
    select: { id: true },
  });

  if (!conversation) return null;

  const { assigneeId, assignedAt } = await pickAssignee();
  if (!assigneeId) return null;

  const { count } = await prisma.conversation.updateMany({
    where: { id: conversationId, assigneeId: null },
    data: { assigneeId, assignedAt },
  });

  if (count === 0) return null;

  await recordAutoAssignment(conversationId, assigneeId);

  return assigneeId;
}

/*
 * A routing decision is a state change on the conversation, so it gets the same
 * trail a manual reassignment does — with a null actor, which the audit schema
 * uses for a system write. Ids only: who answers a chat is not PII, the chat is.
 */
export async function recordAutoAssignment(
  conversationId: string,
  assigneeId: string,
): Promise<void> {
  await record({
    actor: null,
    action: AuditAction.CONVERSATION_ASSIGNED,
    entityType: 'Conversation',
    entityId: conversationId,
    metadata: { to: assigneeId, automatic: true },
  });

  logger.debug({ conversationId, assigneeId }, 'Support chat auto-assigned');
}
