import { ConversationKind, ConversationStatus, StaffStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../lib/roles.js';

/*
 * Who answers an incoming chat.
 *
 * This earns a suite under AGENTS.md's "critical paths only" rule because it is
 * now the ONLY thing that puts a customer's message in front of a human. An agent
 * sees exactly the chats assigned to them, so a router that picks nobody — or
 * picks the same person every time — is not an imbalance, it is a queue of
 * conversations no member of staff can open.
 *
 * The four rules, in the order the router applies them:
 *
 *   1. Only ACTIVE staff holding the `support` area are eligible; admins are out
 *      of the rotation, and a deactivated member is out of it too.
 *   2. An agent who is online and available is preferred, with a fallback to the
 *      whole eligible set so an overnight chat still lands somewhere.
 *   3. Load balances on OPEN threads, not lifetime totals.
 *   4. Equal load breaks on who has waited longest — the part that makes it a
 *      rotation rather than a permanently-sorted list.
 *
 * Rules 2 to 4 are asserted against `chooseAgent`, which is the whole policy as a
 * pure function. That is not test convenience: the suite shares a Postgres with
 * whatever staff the developer has seeded, so an assertion of the form "AGENT_C
 * wins" would be answering a question about their database rather than about the
 * algorithm. The two queries around the choice get the assertions that hold no
 * matter who else is in the table.
 */

const { prisma } = await import('../../lib/prisma.js');
const assignment = await import('./support.assignment.js');

const AGENT_A = 'assign_test_agent_a';
const AGENT_B = 'assign_test_agent_b';
const AGENT_C = 'assign_test_agent_c';
const INACTIVE = 'assign_test_inactive';
const NO_SUPPORT = 'assign_test_no_support';
const ADMIN = 'assign_test_admin';
const CUSTOMER = 'assign_test_customer';

const AGENT_IDS = [AGENT_A, AGENT_B, AGENT_C];
const INELIGIBLE = [INACTIVE, NO_SUPPORT, ADMIN];
const USER_IDS = [...AGENT_IDS, ...INELIGIBLE, CUSTOMER];

const at = (iso: string) => new Date(iso);

function candidate(
  userId: string,
  openThreads: number,
  lastAssignedAt: Date | null = null,
) {
  return { userId, openThreads, lastAssignedAt };
}

async function makeUser(id: string, role: Role) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@assign-test.example`, role },
    update: { role },
  });
}

async function makeStaff(
  id: string,
  role: Role,
  profile: { status: StaffStatus; permissions: string[] },
) {
  await makeUser(id, role);
  await prisma.staffProfile.upsert({
    where: { userId: id },
    create: { userId: id, roleKey: 'support-agent', ...profile },
    update: profile,
  });
}

/*
 * A thread already on someone's desk. `assignedAt` is explicit rather than
 * defaulted, because the tie-break reads it — a fixture that let it drift would
 * make the recency assertions depend on how fast the suite ran.
 */
async function existingThread(options: {
  assigneeId: string;
  status: ConversationStatus;
  assignedAt: Date;
}) {
  return prisma.conversation.create({
    data: {
      customerId: CUSTOMER,
      kind: ConversationKind.SUPPORT,
      subject: 'Assignment fixture',
      status: options.status,
      assigneeId: options.assigneeId,
      assignedAt: options.assignedAt,
      lastMessageAt: options.assignedAt,
    },
  });
}

beforeEach(async () => {
  await prisma.conversation.deleteMany({ where: { customerId: CUSTOMER } });

  for (const id of AGENT_IDS) {
    await makeStaff(id, Role.STAFF, {
      status: StaffStatus.ACTIVE,
      permissions: ['support'],
    });
  }

  await makeStaff(INACTIVE, Role.STAFF, {
    status: StaffStatus.DEACTIVATED,
    permissions: ['support'],
  });
  await makeStaff(NO_SUPPORT, Role.STAFF, {
    status: StaffStatus.ACTIVE,
    permissions: ['orders'],
  });
  // An operations manager: holds support, and is an admin. Supervises the queue
  // rather than sitting in it.
  await makeStaff(ADMIN, Role.ADMIN, {
    status: StaffStatus.ACTIVE,
    permissions: ['support', 'support.all', 'support.assign'],
  });

  await makeUser(CUSTOMER, Role.CUSTOMER);
});

afterAll(async () => {
  await prisma.conversation.deleteMany({ where: { customerId: CUSTOMER } });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
  await prisma.$disconnect();
});

// --- Rule 1: who is even in the running --------------------------------------
describe('eligibility', () => {
  /*
   * Stated as "never one of these" rather than "always one of ours", because the
   * database holds real staff too. The property that matters is the exclusion:
   * a chat routed to a deactivated account, or to someone without the support
   * area, is a chat nobody will ever open.
   */
  it('never routes to a deactivated member, a member without support, or an admin', async () => {
    const picks = new Set<string | null>();

    // Several rounds, each recording its pick, so the rotation actually moves
    // rather than re-answering the same empty-load question.
    for (let round = 0; round < 8; round += 1) {
      const { assigneeId, assignedAt } = await assignment.pickAssignee();
      picks.add(assigneeId);

      if (assigneeId) {
        await existingThread({
          assigneeId,
          status: ConversationStatus.OPEN,
          assignedAt: assignedAt ?? new Date(),
        });
      }
    }

    for (const excluded of INELIGIBLE) {
      expect(picks.has(excluded)).toBe(false);
    }
  });

  it('offers the eligible fixtures to the router', async () => {
    // The inverse check: the exclusions above would also pass if the query
    // returned nothing at all.
    const picks = new Set<string | null>();

    for (let round = 0; round < 12; round += 1) {
      const { assigneeId, assignedAt } = await assignment.pickAssignee();
      picks.add(assigneeId);

      if (assigneeId) {
        await existingThread({
          assigneeId,
          status: ConversationStatus.OPEN,
          assignedAt: assignedAt ?? new Date(),
        });
      }
    }

    expect(AGENT_IDS.some((id) => picks.has(id))).toBe(true);
  });
});

// --- Rule 3's input: what "load" counts --------------------------------------
describe('load', () => {
  /*
   * The distinction that makes the figure mean "what are you carrying" rather
   * than "how long have you worked here". An agent who has closed a hundred chats
   * is not busy.
   */
  it('counts open threads and ignores resolved ones', async () => {
    for (const day of ['01', '02', '03']) {
      await existingThread({
        assigneeId: AGENT_A,
        status: ConversationStatus.RESOLVED,
        assignedAt: at(`2026-07-${day}T10:00:00Z`),
      });
    }
    await existingThread({
      assigneeId: AGENT_B,
      status: ConversationStatus.OPEN,
      assignedAt: at('2026-07-04T10:00:00Z'),
    });
    await existingThread({
      assigneeId: AGENT_B,
      status: ConversationStatus.PENDING,
      assignedAt: at('2026-07-05T10:00:00Z'),
    });

    const loads = await assignment.loadFor(AGENT_IDS);
    const byAgent = new Map(loads.map((row) => [row.userId, row]));

    expect(byAgent.get(AGENT_A)?.openThreads).toBe(0);
    // PENDING is still on their desk — it is waiting on the customer, not closed.
    expect(byAgent.get(AGENT_B)?.openThreads).toBe(2);
    expect(byAgent.get(AGENT_C)?.openThreads).toBe(0);
  });

  /*
   * Recency spans resolved threads, unlike load. An agent who cleared their queue
   * an hour ago has not been waiting since their oldest unresolved chat, and
   * reading it off the open ones alone would keep handing them work.
   */
  it('reads recency across resolved threads too', async () => {
    await existingThread({
      assigneeId: AGENT_A,
      status: ConversationStatus.RESOLVED,
      assignedAt: at('2026-07-09T10:00:00Z'),
    });

    const loads = await assignment.loadFor(AGENT_IDS);
    const agentA = loads.find((row) => row.userId === AGENT_A);

    expect(agentA?.openThreads).toBe(0);
    expect(agentA?.lastAssignedAt).toEqual(at('2026-07-09T10:00:00Z'));
  });

  it('reports an agent who has never been given a chat as never assigned', async () => {
    const loads = await assignment.loadFor(AGENT_IDS);

    expect(loads.find((row) => row.userId === AGENT_C)).toEqual({
      userId: AGENT_C,
      openThreads: 0,
      lastAssignedAt: null,
    });
  });
});

// --- Rules 2 to 4: the choice ------------------------------------------------
describe('choosing between candidates', () => {
  const none = new Set<string>();

  it('picks the agent carrying the fewest open threads', () => {
    const chosen = assignment.chooseAgent(
      [candidate('busy', 4), candidate('quiet', 1), candidate('steady', 2)],
      none,
    );

    expect(chosen?.userId).toBe('quiet');
  });

  // Equal load is the common case on a small team, so the tie-break is what the
  // rotation actually runs on day to day.
  it('breaks equal load on who was assigned longest ago', () => {
    const chosen = assignment.chooseAgent(
      [
        candidate('recent', 2, at('2026-07-05T10:00:00Z')),
        candidate('waiting', 2, at('2026-07-01T10:00:00Z')),
        candidate('middle', 2, at('2026-07-03T10:00:00Z')),
      ],
      none,
    );

    expect(chosen?.userId).toBe('waiting');
  });

  it('sends the first chat to someone who has never had one', () => {
    const chosen = assignment.chooseAgent(
      [candidate('veteran', 0, at('2026-07-05T10:00:00Z')), candidate('new-joiner', 0)],
      none,
    );

    expect(chosen?.userId).toBe('new-joiner');
  });

  // Load leads: waiting longest does not earn a chat you have no room for.
  it('does not let recency outrank load', () => {
    const chosen = assignment.chooseAgent(
      [
        candidate('swamped', 9, at('2026-01-01T10:00:00Z')),
        candidate('free', 0, at('2026-07-28T10:00:00Z')),
      ],
      none,
    );

    expect(chosen?.userId).toBe('free');
  });

  it('prefers an available agent over an idle colleague with less load', () => {
    const chosen = assignment.chooseAgent(
      [candidate('offline', 0), candidate('here', 3)],
      new Set(['here']),
    );

    expect(chosen?.userId).toBe('here');
  });

  it('balances within the online tier rather than taking the first of them', () => {
    const chosen = assignment.chooseAgent(
      [candidate('online-busy', 5), candidate('online-quiet', 1), candidate('offline', 0)],
      new Set(['online-busy', 'online-quiet']),
    );

    expect(chosen?.userId).toBe('online-quiet');
  });

  /*
   * The fallback that keeps the queue from stalling overnight. A chat with nobody
   * online still has to reach a desk — the alternative is an unassigned thread
   * only a supervisor can see, waiting for morning.
   */
  it('falls back to the whole team when nobody is online', () => {
    const chosen = assignment.chooseAgent([candidate('a', 3), candidate('b', 1)], none);

    expect(chosen?.userId).toBe('b');
  });

  it('picks nobody when there is nobody to pick', () => {
    expect(assignment.chooseAgent([], none)).toBeUndefined();
  });
});

// --- The safety net ----------------------------------------------------------
describe('ensureAssigned', () => {
  it('gives an ownerless thread an owner', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        customerId: CUSTOMER,
        kind: ConversationKind.SUPPORT,
        subject: 'Predates automatic routing',
        status: ConversationStatus.OPEN,
        lastMessageAt: new Date(),
      },
    });

    const assigneeId = await assignment.ensureAssigned(conversation.id);

    expect(assigneeId).not.toBeNull();

    const row = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      select: { assigneeId: true, assignedAt: true },
    });
    expect(row?.assigneeId).toBe(assigneeId);
    expect(row?.assignedAt).not.toBeNull();
  });

  /*
   * It runs on every inbound message into an ownerless thread, so it has to be a
   * compare-and-set rather than an assignment: a thread that already has an agent
   * must never be moved off them by a customer sending a second message.
   */
  it('leaves a thread that already has an owner alone', async () => {
    const conversation = await existingThread({
      assigneeId: AGENT_B,
      status: ConversationStatus.OPEN,
      assignedAt: at('2026-07-01T10:00:00Z'),
    });

    // The existing owner comes back rather than null: callers broadcast this as
    // the conversation's assignee, so "I did not route it" must not read as
    // "nobody owns it".
    expect(await assignment.ensureAssigned(conversation.id)).toBe(AGENT_B);

    const row = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      select: { assigneeId: true },
    });
    expect(row?.assigneeId).toBe(AGENT_B);
  });

  /*
   * Two messages landing on the same ownerless thread at once: one wins the
   * compare-and-set, the other loses it. The loser must still report the owner
   * the thread now has — reporting null would broadcast a thread as unassigned
   * moments after it was routed.
   */
  it('reports the winner when it loses the compare-and-set', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        customerId: CUSTOMER,
        kind: ConversationKind.SUPPORT,
        subject: 'Two messages at once',
        status: ConversationStatus.OPEN,
        lastMessageAt: new Date(),
      },
    });

    const [first, second] = await Promise.all([
      assignment.ensureAssigned(conversation.id),
      assignment.ensureAssigned(conversation.id),
    ]);

    const row = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      select: { assigneeId: true },
    });

    expect(row?.assigneeId).not.toBeNull();
    expect(first).toBe(row?.assigneeId);
    expect(second).toBe(row?.assigneeId);
  });
});
