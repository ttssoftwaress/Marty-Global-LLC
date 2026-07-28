import {
  OrderDocumentSource,
  OrderDocumentStatus,
  OrderStatus,
  StaffStatus,
} from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../../lib/roles.js';
import type { AuthContext } from '../../../guards/auth-context.js';

/*
 * The three rules the admin order screens lean on, tested against a real
 * database because all of them are enforced in Prisma queries rather than in
 * code the screen could be trusted to repeat:
 *
 *   - the assignee scope: an employee only ever sees the filings they hold
 *   - the status pipeline: staff advance one step, an admin overrides
 *   - note visibility: an internal note must never reach the customer
 *
 * The first and third are the ones worth a test even under AGENTS.md's "critical
 * paths only" rule — both are authorization boundaries, and a leaked internal
 * note is not a bug you can take back.
 */

// The reply email goes through notifications (Redis/SES); mock it so these tests
// exercise the orders logic and the DB only.
const queueEmail = vi.hoisted(() => vi.fn(async () => ({ id: 'notif_test' })));
vi.mock('../../notifications/notifications.service.js', () => ({ queueEmail }));

const { prisma } = await import('../../../lib/prisma.js');
const {
  addActivity,
  getDocumentLink,
  getOrder,
  getSummary,
  listOrders,
  updateOrder,
} = await import('./orders.service.js');
const { getOrderDetail } = await import('../../orders/orders.service.js');

const CUSTOMER_ID = 'admin_orders_test_customer';
const STAFF_ID = 'admin_orders_test_staff';
// A second reviewer, so "someone else's filing" is a real order rather than an
// unassigned one — the two are different misses and both have to 404.
const OTHER_STAFF_ID = 'admin_orders_test_other_staff';
const ADMIN_ID = 'admin_orders_test_admin';
const USER_IDS = [CUSTOMER_ID, STAFF_ID, OTHER_STAFF_ID, ADMIN_ID];

const COMPANY = 'company-formation';

function auth(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.com`,
    emailVerified: true,
  };
}

// The customer-side detail service reads the caller from the request the guard
// populated; a bare object with an auth context is the whole contract.
const reqAs = (context: AuthContext) => ({ auth: context }) as never;

async function ensureUser(id: string, role: Role) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.com`, role },
    update: { role },
  });
}

async function ensureStaff(id: string, roleKey: string) {
  await prisma.staffProfile.upsert({
    where: { userId: id },
    create: { userId: id, roleKey, status: StaffStatus.ACTIVE, permissions: ['orders'] },
    update: { status: StaffStatus.ACTIVE, permissions: ['orders'] },
  });
}

// Assigned to the staff fixture by default: the queue is scoped to its assignee,
// so an order nobody holds is invisible to a reviewer and every test about what
// they can do to one would 404 before reaching the rule it is checking.
async function createOrder(
  status: OrderStatus,
  assigneeId: string | null = STAFF_ID,
) {
  return prisma.order.create({
    data: {
      reference: `ORD-T${Math.floor(10_000 + Math.random() * 89_999)}`,
      customerId: CUSTOMER_ID,
      status,
      assigneeId,
      submittedAt: new Date(),
      items: {
        create: {
          serviceId: COMPANY,
          serviceName: 'Company Formation',
          answers: { companyName: 'North Peak LLC', jurisdiction: 'us-de' },
          sortOrder: 0,
        },
      },
    },
  });
}

beforeEach(async () => {
  queueEmail.mockClear();
  await ensureUser(CUSTOMER_ID, Role.CUSTOMER);
  await ensureUser(STAFF_ID, Role.STAFF);
  await ensureUser(OTHER_STAFF_ID, Role.STAFF);
  await ensureUser(ADMIN_ID, Role.ADMIN);
  await ensureStaff(STAFF_ID, 'reviewer');
  await ensureStaff(OTHER_STAFF_ID, 'reviewer');
  await ensureStaff(ADMIN_ID, 'super-admin');
  // Quotes first, and per-test: a quote left behind gates nothing, but it would
  // un-gate APPROVED on the next test's order and pass for the wrong reason.
  await prisma.quote.deleteMany({ where: { customerId: CUSTOMER_ID } });
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
});

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { customerId: CUSTOMER_ID } });
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
  await prisma.$disconnect();
});

/*
 * The assignee scope. A reviewer's queue is their own work: an order held by
 * someone else — or by nobody — is not theirs to see, to open, or to act on.
 *
 * Every assertion here is about a query's where clause rather than about a
 * filter over results, which is why it is worth a database test: a scope applied
 * after the fact would pass a unit test and still hand the rows over.
 */
describe('the assignee scope', () => {
  const listFor = (userId: string, role: Role) =>
    listOrders(auth(userId, role), { status: 'all', limit: 50 });

  it('lists only the orders assigned to this member', async () => {
    const mine = await createOrder(OrderStatus.SUBMITTED);
    const theirs = await createOrder(OrderStatus.SUBMITTED, OTHER_STAFF_ID);
    const nobodys = await createOrder(OrderStatus.SUBMITTED, null);

    const page = await listFor(STAFF_ID, Role.STAFF);
    const ids = page.orders.map((row) => row.id);

    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    expect(ids).not.toContain(nobodys.id);
  });

  it('shows an admin every order', async () => {
    const theirs = await createOrder(OrderStatus.SUBMITTED, OTHER_STAFF_ID);
    const nobodys = await createOrder(OrderStatus.SUBMITTED, null);

    const ids = (await listFor(ADMIN_ID, Role.ADMIN)).orders.map((row) => row.id);

    expect(ids).toEqual(expect.arrayContaining([theirs.id, nobodys.id]));
  });

  // Whoever hands out the work has to be able to see what is unclaimed.
  it('shows every order to a staff member who can assign', async () => {
    await prisma.staffProfile.update({
      where: { userId: STAFF_ID },
      data: { permissions: ['orders', 'orders.assign'] },
    });

    const nobodys = await createOrder(OrderStatus.SUBMITTED, null);

    const ids = (await listFor(STAFF_ID, Role.STAFF)).orders.map((row) => row.id);

    expect(ids).toContain(nobodys.id);
  });

  // The tabs are counted over the same scope, or the queue would advertise rows
  // it then refuses to list.
  it('counts the header figures and the tabs over the same scope', async () => {
    await createOrder(OrderStatus.SUBMITTED);
    await createOrder(OrderStatus.SUBMITTED, OTHER_STAFF_ID);
    await createOrder(OrderStatus.SUBMITTED, null);

    const summary = await getSummary(auth(STAFF_ID, Role.STAFF));

    expect(summary.scope).toBe('assigned');
    expect(summary.totalOrders).toBe(1);
    expect(summary.awaitingReview).toBe(1);
    expect(summary.tabs.find((tab) => tab.value === 'submitted')?.count).toBe(1);

    const adminSummary = await getSummary(auth(ADMIN_ID, Role.ADMIN));
    expect(adminSummary.scope).toBe('all');
    expect(adminSummary.totalOrders).toBeGreaterThanOrEqual(3);
  });

  /*
   * 404, not 403: an order this member does not hold is not confirmed to exist
   * (guards/ownership.ts). Reading, moving, and replying all miss the same way —
   * hiding the row from the queue would be decoration if the id still worked.
   */
  it("refuses to open, move, or reply on someone else's order", async () => {
    const theirs = await createOrder(OrderStatus.SUBMITTED, OTHER_STAFF_ID);
    const actor = auth(STAFF_ID, Role.STAFF);

    await expect(getOrder(actor, theirs.id)).rejects.toMatchObject({ status: 404 });

    await expect(
      updateOrder(actor, theirs.id, { status: 'under_review' }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      addActivity(actor, theirs.id, { message: 'Looking at this.', visibility: 'customer' }),
    ).rejects.toMatchObject({ status: 404 });

    const unchanged = await prisma.order.findFirstOrThrow({ where: { id: theirs.id } });
    expect(unchanged.status).toBe(OrderStatus.SUBMITTED);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  /*
   * The documents are the sharpest case of the scope, which is why they get their
   * own assertion rather than riding along above: the link this mints is a bearer
   * token for a customer's identity paperwork, so a member reaching one on an
   * order they do not hold would not merely be seeing a row they shouldn't — they
   * would be holding the file.
   */
  it("refuses to mint a document link on someone else's order", async () => {
    const theirs = await createOrder(OrderStatus.SUBMITTED, OTHER_STAFF_ID);
    const document = await prisma.orderDocument.create({
      data: {
        orderId: theirs.id,
        name: 'passport.pdf',
        status: OrderDocumentStatus.AVAILABLE,
        source: OrderDocumentSource.CUSTOMER,
        objectKey: 'orders/some-customer/uuid/passport.pdf',
        contentType: 'application/pdf',
      },
    });

    await expect(
      getDocumentLink(auth(STAFF_ID, Role.STAFF), theirs.id, document.id, {
        disposition: 'inline',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

/*
 * The Documents card's View and Download controls.
 *
 * Only the refusals are asserted here: minting a real URL needs a configured R2
 * bucket, which the test environment deliberately does not have (AGENTS.md —
 * tests never reach a real service). What matters at this layer is that a row
 * with nothing behind it is refused rather than handed a link to an object that
 * was never uploaded.
 */
describe('getDocumentLink', () => {
  const inline = { disposition: 'inline' } as const;

  it('refuses a pending placeholder, which has no object behind it', async () => {
    const order = await createOrder(OrderStatus.PROCESSING);
    const placeholder = await prisma.orderDocument.create({
      data: {
        orderId: order.id,
        name: 'Certificate of Formation',
        status: OrderDocumentStatus.PENDING,
        source: OrderDocumentSource.TEAM,
      },
    });

    await expect(
      getDocumentLink(auth(STAFF_ID, Role.STAFF), order.id, placeholder.id, inline),
    ).rejects.toMatchObject({
      status: 422,
      message: 'That document has no file behind it yet',
    });
  });

  it('404s an unknown document rather than confirming the id', async () => {
    const order = await createOrder(OrderStatus.UNDER_REVIEW);

    await expect(
      getDocumentLink(auth(STAFF_ID, Role.STAFF), order.id, 'no_such_document', inline),
    ).rejects.toMatchObject({ status: 404 });
  });

  // A document filed against a different order is not reachable through this one,
  // even by the member who holds both.
  it('refuses a document that belongs to another order', async () => {
    const order = await createOrder(OrderStatus.UNDER_REVIEW);
    const other = await createOrder(OrderStatus.UNDER_REVIEW);

    const document = await prisma.orderDocument.create({
      data: {
        orderId: other.id,
        name: 'proof-of-address.pdf',
        status: OrderDocumentStatus.AVAILABLE,
        source: OrderDocumentSource.CUSTOMER,
        objectKey: 'orders/some-customer/uuid/proof-of-address.pdf',
      },
    });

    await expect(
      getDocumentLink(auth(STAFF_ID, Role.STAFF), order.id, document.id, inline),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an unassigned order to a member who cannot assign', async () => {
    const nobodys = await createOrder(OrderStatus.SUBMITTED, null);

    await expect(
      getOrder(auth(STAFF_ID, Role.STAFF), nobodys.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateOrder — the status pipeline', () => {
  it('advances an order one step and records it on the feed', async () => {
    const order = await createOrder(OrderStatus.SUBMITTED);

    const row = await updateOrder(auth(STAFF_ID, Role.STAFF), order.id, {
      status: 'under_review',
    });

    expect(row.status).toBe('under_review');

    const entries = await prisma.orderActivity.findMany({ where: { orderId: order.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.internal).toBe(false);
    expect(entries[0]?.message).toContain('Under review');
  });

  it('refuses a step a staff member cannot make from here', async () => {
    const order = await createOrder(OrderStatus.SUBMITTED);

    await expect(
      updateOrder(auth(STAFF_ID, Role.STAFF), order.id, { status: 'completed' }),
    ).rejects.toMatchObject({ status: 422 });

    const unchanged = await prisma.order.findFirstOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe(OrderStatus.SUBMITTED);
  });

  it('lets an admin override the pipeline', async () => {
    const order = await createOrder(OrderStatus.SUBMITTED);

    const row = await updateOrder(auth(ADMIN_ID, Role.ADMIN), order.id, {
      status: 'completed',
    });

    expect(row.status).toBe('completed');
  });

  /*
   * The pipeline offers MISSING_INFO and APPROVED out of review — but APPROVED is
   * gated on the order having been priced, so an unquoted order shows only the
   * first of the two. The block is flagged rather than silently dropped, so the
   * screen can explain it and point at the quote composer.
   */
  it('offers only the reachable statuses to a staff member', async () => {
    const order = await createOrder(OrderStatus.UNDER_REVIEW);

    const detail = await getOrder(auth(STAFF_ID, Role.STAFF), order.id);
    const allowed = detail.statusOptions
      .filter((option) => option.allowed)
      .map((option) => option.value);

    expect(allowed).toEqual(['missing_info']);
    expect(
      detail.statusOptions.find((option) => option.value === 'approved')
        ?.blockedReason,
    ).toBe('quote_required');
    expect(detail.statusOptions.find((option) => option.current)?.value).toBe(
      'under_review',
    );
  });

  // Once the order has a price, APPROVED joins the reachable set — the pipeline
  // step was never removed, only gated.
  it('offers approved once the order has been quoted', async () => {
    const order = await createOrder(OrderStatus.UNDER_REVIEW);

    await prisma.quote.create({
      data: {
        reference: `QT-P${Math.floor(10_000 + Math.random() * 89_999)}`,
        customerId: CUSTOMER_ID,
        orderId: order.id,
        serviceName: 'Company Formation',
        subtotal: 49_900,
        total: 49_900,
        currency: 'USD',
        issuedAt: new Date(),
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const detail = await getOrder(auth(STAFF_ID, Role.STAFF), order.id);
    const allowed = detail.statusOptions
      .filter((option) => option.allowed)
      .map((option) => option.value);

    expect(allowed).toEqual(['missing_info', 'approved']);
  });

  /*
   * The tail of the pipeline — APPROVED → PAID → PROCESSING → COMPLETED. Two of
   * these have automation behind them (a sent quote, a settled payment), but a
   * reviewer must still be able to set all four by hand: money arrives by wire
   * and over the phone, and a filing being worked is something only a person can
   * observe. This walks the whole tail as a staff member to prove none of it
   * needs an admin.
   */
  it('walks an approved order through paid, processing, and completed', async () => {
    const order = await createOrder(OrderStatus.APPROVED);
    const actor = auth(STAFF_ID, Role.STAFF);

    for (const status of ['paid', 'processing', 'completed'] as const) {
      const row = await updateOrder(actor, order.id, { status });
      expect(row.status).toBe(status);
    }

    const final = await prisma.order.findFirstOrThrow({ where: { id: order.id } });
    expect(final.status).toBe(OrderStatus.COMPLETED);

    // Every step is on the customer's feed, in order — the whole point of the
    // status existing is that the customer can see it.
    const entries = await prisma.orderActivity.findMany({
      where: { orderId: order.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(entries.map((entry) => entry.message)).toEqual([
      'Status changed to Paid.',
      'Status changed to Processing.',
      'Status changed to Completed.',
    ]);
  });

  // Processing sits between paid and completed, so a paid order cannot skip it.
  it('refuses to skip processing on the way to completed', async () => {
    const order = await createOrder(OrderStatus.PAID);

    await expect(
      updateOrder(auth(STAFF_ID, Role.STAFF), order.id, { status: 'completed' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('keeps the assignment off the customer-visible feed', async () => {
    // Unassigned, so handing it to the reviewer is a real change rather than a
    // no-op that would write nothing to the feed.
    const order = await createOrder(OrderStatus.SUBMITTED, null);

    await updateOrder(auth(ADMIN_ID, Role.ADMIN), order.id, { assigneeId: STAFF_ID });

    const entry = await prisma.orderActivity.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(entry.internal).toBe(true);
  });
});

/*
 * Assignment is a separate grant from working an order (`orders.assign`). The
 * reviewer fixture holds `orders` only, which is exactly the member this rule
 * exists for: they advance and answer their own filings but do not decide who
 * on the team owns one.
 */
describe('updateOrder — the assign permission', () => {
  it('refuses a reassignment by a staff member without orders.assign', async () => {
    const order = await createOrder(OrderStatus.SUBMITTED);

    await expect(
      updateOrder(auth(STAFF_ID, Role.STAFF), order.id, {
        assigneeId: OTHER_STAFF_ID,
      }),
    ).rejects.toMatchObject({ status: 403 });

    const unchanged = await prisma.order.findFirstOrThrow({ where: { id: order.id } });
    expect(unchanged.assigneeId).toBe(STAFF_ID);
  });

  it('still lets that member advance the status', async () => {
    const order = await createOrder(OrderStatus.SUBMITTED);

    const row = await updateOrder(auth(STAFF_ID, Role.STAFF), order.id, {
      status: 'under_review',
    });

    expect(row.status).toBe('under_review');
  });

  it('allows the reassignment once the area is granted', async () => {
    await prisma.staffProfile.update({
      where: { userId: STAFF_ID },
      data: { permissions: ['orders', 'orders.assign'] },
    });

    // Unassigned on purpose: the grant is what makes an order nobody holds
    // visible to this member in the first place, which is the whole point of
    // being the one who distributes the work.
    const order = await createOrder(OrderStatus.SUBMITTED, null);

    const row = await updateOrder(auth(STAFF_ID, Role.STAFF), order.id, {
      assigneeId: OTHER_STAFF_ID,
    });

    expect(row.assignee?.name).toBe(`Test ${OTHER_STAFF_ID}`);
  });

  it('tells the screen which of the two controls this actor may use', async () => {
    const order = await createOrder(OrderStatus.SUBMITTED);

    const staffView = await getOrder(auth(STAFF_ID, Role.STAFF), order.id);
    expect(staffView.canAssign).toBe(false);

    const adminView = await getOrder(auth(ADMIN_ID, Role.ADMIN), order.id);
    expect(adminView.canAssign).toBe(true);
  });
});

describe('addActivity — replying to the customer', () => {
  it('posts a visible reply and queues the customer an email', async () => {
    const order = await createOrder(OrderStatus.UNDER_REVIEW);

    const entry = await addActivity(auth(STAFF_ID, Role.STAFF), order.id, {
      message: 'We have started the name availability check.',
      visibility: 'customer',
    });

    expect(entry.internal).toBe(false);
    expect(queueEmail).toHaveBeenCalledTimes(1);

    const detail = await getOrderDetail(reqAs(auth(CUSTOMER_ID, Role.CUSTOMER)), order.id);
    expect(detail.activity.map((item) => item.message)).toContain(
      'We have started the name availability check.',
    );
  });

  it('keeps an internal note off the customer’s order and sends nothing', async () => {
    const order = await createOrder(OrderStatus.UNDER_REVIEW);

    await addActivity(auth(STAFF_ID, Role.STAFF), order.id, {
      message: 'Flagged for a second compliance pass before we quote.',
      visibility: 'internal',
    });

    expect(queueEmail).not.toHaveBeenCalled();

    const detail = await getOrderDetail(reqAs(auth(CUSTOMER_ID, Role.CUSTOMER)), order.id);
    expect(detail.activity).toHaveLength(0);

    // The admin feed still has it — the note exists, it is only scoped.
    const adminDetail = await getOrder(auth(STAFF_ID, Role.STAFF), order.id);
    expect(adminDetail.activity.filter((item) => item.internal)).toHaveLength(1);
  });
});
