import { FeedNotificationCategory, StaffStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../lib/roles.js';

/*
 * The in-app notification gate, and who a staff notification reaches.
 *
 * `notifyFeed` is the only way a customer-facing feed row gets written, and the
 * point of it is that naming a preference category is what makes the write
 * possible at all — the five hand-rolled `feedNotification.create` calls it
 * replaced were each independently responsible for remembering to check, which
 * is the failure mode `notifications.preferences.ts` already records for email.
 *
 * The staff half is a different question: not "does this person want it" (a work
 * queue is not opt-out) but "is this person entitled to it". That is answered by
 * the same `.all` scope grant the list endpoints read, plus whoever holds the
 * record — so the bell can never announce work the screen behind it would hide.
 */

const { prisma } = await import('../../lib/prisma.js');
const { createFeedNotification, notifyFeed } = await import(
  './notifications.feed.js'
);
const { notifyStaffDocumentUploaded, notifyStaffPaymentConfirmed } = await import(
  '../admin/admin.notifications.js'
);

const CUSTOMER_ID = 'feed_test_customer';
// A supervisor (holds `orders.all`), a reviewer who holds only the area, and a
// mail operator who holds neither — the three cases routing has to separate.
const SUPERVISOR_ID = 'feed_test_supervisor';
const REVIEWER_ID = 'feed_test_reviewer';
const OUTSIDER_ID = 'feed_test_outsider';

const ALL_IDS = [CUSTOMER_ID, SUPERVISOR_ID, REVIEWER_ID, OUTSIDER_ID];

async function makeUser(id: string, role: Role) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: id, email: `${id}@example.test`, role },
    update: { role },
  });
}

async function makeStaff(userId: string, permissions: string[]) {
  await prisma.staffProfile.upsert({
    where: { userId },
    create: {
      userId,
      roleKey: 'reviewer',
      status: StaffStatus.ACTIVE,
      permissions,
    },
    update: { permissions, status: StaffStatus.ACTIVE },
  });
}

async function feedFor(userId: string) {
  return prisma.feedNotification.findMany({
    where: { userId, deletedAt: null },
    select: { category: true, message: true, href: true },
  });
}

beforeEach(async () => {
  await prisma.feedNotification.deleteMany({ where: { userId: { in: ALL_IDS } } });
  await prisma.notificationPreference.deleteMany({
    where: { userId: { in: ALL_IDS } },
  });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: ALL_IDS } } });

  await makeUser(CUSTOMER_ID, Role.CUSTOMER);
  await makeUser(SUPERVISOR_ID, Role.STAFF);
  await makeUser(REVIEWER_ID, Role.STAFF);
  await makeUser(OUTSIDER_ID, Role.STAFF);

  await makeStaff(SUPERVISOR_ID, ['orders', 'orders.all', 'payments', 'payments.all']);
  await makeStaff(REVIEWER_ID, ['orders']);
  await makeStaff(OUTSIDER_ID, ['mailroom', 'mailroom.all']);
});

afterAll(async () => {
  await prisma.feedNotification.deleteMany({ where: { userId: { in: ALL_IDS } } });
  await prisma.notificationPreference.deleteMany({
    where: { userId: { in: ALL_IDS } },
  });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: ALL_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: ALL_IDS } } });
  await prisma.$disconnect();
});

describe('notifyFeed', () => {
  // The absent-row default. Nearly every real customer has never opened the
  // settings screen, so if "no row" resolved to muted the default account would
  // receive nothing at all.
  it('writes a row for a customer who has never set a preference', async () => {
    const result = await notifyFeed({
      userId: CUSTOMER_ID,
      preference: 'statusUpdates',
      category: FeedNotificationCategory.ORDER,
      message: 'Order MG-1 has been approved.',
      href: '/app/orders/1',
    });

    expect(result.created).toBe(true);
    expect(await feedFor(CUSTOMER_ID)).toEqual([
      {
        category: FeedNotificationCategory.ORDER,
        message: 'Order MG-1 has been approved.',
        href: '/app/orders/1',
      },
    ]);
  });

  it('writes nothing when the customer turned that category off in-app', async () => {
    await prisma.notificationPreference.create({
      data: { userId: CUSTOMER_ID, statusUpdatesInApp: false },
    });

    const result = await notifyFeed({
      userId: CUSTOMER_ID,
      preference: 'statusUpdates',
      category: FeedNotificationCategory.ORDER,
      message: 'Order MG-1 has been approved.',
    });

    expect(result.created).toBe(false);
    expect(await feedFor(CUSTOMER_ID)).toHaveLength(0);
  });

  /*
   * The email master switch is account-wide but it is an EMAIL switch. A customer
   * who silenced their inbox has not asked to be blinded in the app too, and the
   * settings screen says exactly that — so the bell must keep working.
   */
  it('ignores the email master switch, which does not govern the bell', async () => {
    await prisma.notificationPreference.create({
      data: { userId: CUSTOMER_ID, emailMaster: false, statusUpdatesInApp: true },
    });

    const result = await notifyFeed({
      userId: CUSTOMER_ID,
      preference: 'statusUpdates',
      category: FeedNotificationCategory.PAYMENT,
      message: 'Payment received.',
    });

    expect(result.created).toBe(true);
  });

  /*
   * The ungated variant, for a notice the customer cannot opt out of — an
   * under/overpayment, where AGENTS.md is explicit that it is never a silent
   * pass. A muted category must not be the reason they never learn their money
   * is in limbo.
   */
  it('createFeedNotification writes even for a muted category', async () => {
    await prisma.notificationPreference.create({
      data: { userId: CUSTOMER_ID, statusUpdatesInApp: false },
    });

    await createFeedNotification({
      userId: CUSTOMER_ID,
      category: FeedNotificationCategory.PAYMENT,
      message: 'We received less than the quoted amount.',
    });

    expect(await feedFor(CUSTOMER_ID)).toHaveLength(1);
  });

  // A failure to tell someone must never become a failure of the thing it was
  // telling them about — every caller treats this as fire-and-forget.
  it('swallows its own failure rather than throwing at the caller', async () => {
    await expect(
      notifyFeed({
        userId: 'feed_test_user_that_does_not_exist',
        preference: 'statusUpdates',
        category: FeedNotificationCategory.ORDER,
        message: 'Orphaned row.',
      }),
    ).resolves.toEqual({ created: false });
  });
});

describe('staff notification routing', () => {
  /*
   * The supervisor holds `orders.all` and oversees the whole queue; the reviewer
   * holds only `orders` and hears about a record because it is assigned to them.
   * The mail operator holds neither and must not learn the order exists — the
   * same boundary the list endpoint draws.
   */
  it('reaches the area supervisor and the assignee, and nobody else', async () => {
    await notifyStaffDocumentUploaded({
      orderId: 'order_1',
      reference: 'MG-1',
      assigneeId: REVIEWER_ID,
      documentName: 'Passport copy',
    });

    expect(await feedFor(SUPERVISOR_ID)).toHaveLength(1);
    expect(await feedFor(REVIEWER_ID)).toHaveLength(1);
    expect(await feedFor(OUTSIDER_ID)).toHaveLength(0);
  });

  // An unassigned record still reaches whoever oversees the queue — that is the
  // prompt to pick it up.
  it('reaches the supervisor alone when nothing is assigned', async () => {
    await notifyStaffDocumentUploaded({
      orderId: 'order_2',
      reference: 'MG-2',
      assigneeId: null,
      documentName: 'Proof of address',
    });

    expect(await feedFor(SUPERVISOR_ID)).toHaveLength(1);
    expect(await feedFor(REVIEWER_ID)).toHaveLength(0);
  });

  /*
   * Routing is per area, not per staff member. Money reconciliation belongs to
   * `payments`, so a member who oversees orders but not payments is not told —
   * otherwise the bell announces a queue they cannot open.
   */
  it('routes a payment to the payments area, not the orders area', async () => {
    await makeStaff(REVIEWER_ID, ['orders', 'orders.all']);

    await notifyStaffPaymentConfirmed({
      paymentId: 'payment_1',
      amountLabel: '$250.00',
      quoteReference: 'Q-1',
    });

    expect(await feedFor(SUPERVISOR_ID)).toHaveLength(1);
    expect(await feedFor(REVIEWER_ID)).toHaveLength(0);
  });

  // A deactivated member's queue is not theirs to work any more.
  it('skips a deactivated member', async () => {
    await prisma.staffProfile.update({
      where: { userId: SUPERVISOR_ID },
      data: { status: StaffStatus.DEACTIVATED },
    });

    await notifyStaffPaymentConfirmed({
      paymentId: 'payment_2',
      amountLabel: '$99.00',
      quoteReference: null,
    });

    expect(await feedFor(SUPERVISOR_ID)).toHaveLength(0);
  });
});
