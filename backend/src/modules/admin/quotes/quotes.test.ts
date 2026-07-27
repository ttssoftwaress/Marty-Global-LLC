import {
  OrderActivityAuthor,
  OrderStatus,
  QuoteStatus,
  StaffStatus,
} from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../../lib/roles.js';
import type { AuthContext } from '../../../guards/auth-context.js';

/*
 * Sending a quote, tested against a real database because the rules that matter
 * are enforced in the service and the schema rather than in anything the screen
 * could be trusted to repeat:
 *
 *   - the totals are integer minor units, summed as integers (AGENTS.md, Money)
 *   - only one live offer stands on an order at a time
 *   - the customer's own order page shows the quote the team sent, and shows it
 *     as expired once the window closes
 *
 * The money assertions are the ones AGENTS.md's "critical paths only" rule
 * singles out: a quote that is a cent wrong is a quote we would have to honour.
 */

const queueEmail = vi.hoisted(() => vi.fn(async () => ({ id: 'notif_test' })));
vi.mock('../../notifications/notifications.service.js', () => ({ queueEmail }));

const { prisma } = await import('../../../lib/prisma.js');
const { cancelQuote, createQuote, listOrderQuotes, listQuoteTemplates } =
  await import('./quotes.service.js');
const { getOrder, updateOrder } = await import('../orders/orders.service.js');
const { getOrderDetail } = await import('../../orders/orders.service.js');

const CUSTOMER_ID = 'quotes_test_customer';
const ADMIN_ID = 'quotes_test_admin';
const USER_IDS = [CUSTOMER_ID, ADMIN_ID];

function auth(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.com`,
    emailVerified: true,
  };
}

const reqAs = (context: AuthContext) => ({ auth: context }) as never;

async function ensureUser(id: string, role: Role) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.com`, role },
    update: { role },
  });
}

async function createOrder() {
  return prisma.order.create({
    data: {
      reference: `ORD-Q${Math.floor(10_000 + Math.random() * 89_999)}`,
      customerId: CUSTOMER_ID,
      status: OrderStatus.UNDER_REVIEW,
      submittedAt: new Date(),
      items: {
        create: {
          serviceId: 'company-formation',
          serviceName: 'Company Formation',
          answers: { companyName: 'North Peak LLC' },
          sortOrder: 0,
        },
      },
    },
  });
}

// $499.00 + $75.50 in minor units — deliberately a value that would drift under
// float arithmetic.
const LINES = [
  { label: 'State filing fee', amount: 49_900 },
  { label: 'Registered agent (1 year)', amount: 7_550 },
];

beforeEach(async () => {
  queueEmail.mockClear();
  await ensureUser(CUSTOMER_ID, Role.CUSTOMER);
  await ensureUser(ADMIN_ID, Role.ADMIN);
  await prisma.staffProfile.upsert({
    where: { userId: ADMIN_ID },
    create: {
      userId: ADMIN_ID,
      roleKey: 'super-admin',
      status: StaffStatus.ACTIVE,
      permissions: ['orders', 'payments'],
    },
    update: { status: StaffStatus.ACTIVE },
  });
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

describe('createQuote', () => {
  it('sums the lines in integer minor units and applies tax and discount', async () => {
    const order = await createOrder();

    const quote = await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 1_000,
      discount: 2_500,
      currency: 'USD',
      validForDays: 14,
    });

    // 49900 + 7550 = 57450; + 1000 tax - 2500 discount = 55950 ($559.50)
    expect(quote.subtotal.amount).toBe(57_450);
    expect(quote.total.amount).toBe(55_950);
    expect(quote.total.currency).toBe('USD');
    expect(Number.isInteger(quote.total.amount)).toBe(true);
    expect(quote.status).toBe('pending');
    expect(quote.reference).toMatch(/^QT-\d{5}$/);
  });

  it('posts the quote to the order feed and emails the customer', async () => {
    const order = await createOrder();

    await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    });

    expect(queueEmail).toHaveBeenCalledTimes(1);

    // The price is the customer's own business — the entry must be visible.
    // Sending a quote also approves the order, which writes its own entry, so
    // this asks for the quote row specifically rather than whichever came first.
    const entry = await prisma.orderActivity.findFirstOrThrow({
      where: { orderId: order.id, message: { startsWith: 'Quote' } },
    });
    expect(entry.internal).toBe(false);
    expect(entry.message).toContain('Quote');
  });

  /*
   * Sending the price is the approval. The reviewer records the decision once,
   * by quoting it — the status they would otherwise have had to remember to set
   * afterwards is the one the customer sees, so it cannot be left to a habit.
   */
  it('approves the order it prices', async () => {
    const order = await createOrder();

    await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    });

    const approved = await prisma.order.findFirstOrThrow({ where: { id: order.id } });
    expect(approved.status).toBe(OrderStatus.APPROVED);

    // Attributed to the system, not to the sender: nobody clicked this.
    const entry = await prisma.orderActivity.findFirstOrThrow({
      where: { orderId: order.id, message: { startsWith: 'Order approved' } },
    });
    expect(entry.author).toBe(OrderActivityAuthor.SYSTEM);
    expect(entry.internal).toBe(false);
  });

  /*
   * The advance only ever moves forward. A second quote raised on an order the
   * team has already been paid for and started work on must not drag it back to
   * APPROVED — the customer would see the filing they are waiting on reappear as
   * un-started.
   */
  it('does not drag an in-flight order back to approved', async () => {
    const order = await createOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PROCESSING },
    });

    await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    });

    const unchanged = await prisma.order.findFirstOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe(OrderStatus.PROCESSING);
  });

  it('refuses a second live quote while one is still awaiting payment', async () => {
    const order = await createOrder();
    const input = {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    };

    await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, input);

    await expect(
      createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, input),
    ).rejects.toMatchObject({ status: 409 });

    expect(await listOrderQuotes(auth(ADMIN_ID, Role.ADMIN), order.id)).toHaveLength(1);
  });

  it('accepts a new quote once the previous one is withdrawn', async () => {
    const order = await createOrder();
    const input = {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    };

    const first = await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, input);
    await cancelQuote(auth(ADMIN_ID, Role.ADMIN), order.id, first.id);

    const second = await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, input);
    expect(second.status).toBe('pending');
  });

  it('refuses a quote that asks for nothing', async () => {
    const order = await createOrder();

    await expect(
      createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
        lineItems: [{ label: 'Waived fee', amount: 5_000 }],
        tax: 0,
        discount: 5_000,
        currency: 'USD',
        validForDays: 14,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

/*
 * Approving is what tells a customer to go and pay, so it cannot happen before
 * anyone has said what the price is. The rule is enforced on the write path and
 * mirrored onto the status control the screen renders; both are tested, because
 * a hand-crafted PATCH never goes near the control.
 */
describe('approval requires a quote', () => {
  it('refuses to approve an order nobody has priced', async () => {
    const order = await createOrder();

    await expect(
      updateOrder(auth(ADMIN_ID, Role.ADMIN), order.id, { status: 'approved' }),
    ).rejects.toMatchObject({ status: 422 });

    const unchanged = await prisma.order.findFirstOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe(OrderStatus.UNDER_REVIEW);
  });

  // The admin override exists to correct a mis-click in the pipeline, not to
  // bypass a rule the customer's billing screen depends on.
  it('refuses an admin too', async () => {
    const order = await createOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.SUBMITTED },
    });

    await expect(
      updateOrder(auth(ADMIN_ID, Role.ADMIN), order.id, { status: 'approved' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('marks APPROVED as blocked on the status control until one is sent', async () => {
    const order = await createOrder();

    const before = await getOrder(auth(ADMIN_ID, Role.ADMIN), order.id);
    const blocked = before.statusOptions.find((o) => o.value === 'approved');
    expect(blocked?.allowed).toBe(false);
    expect(blocked?.blockedReason).toBe('quote_required');

    await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    });

    const after = await getOrder(auth(ADMIN_ID, Role.ADMIN), order.id);
    expect(
      after.statusOptions.find((o) => o.value === 'approved')?.blockedReason,
    ).toBeUndefined();
  });

  /*
   * A withdrawn quote still means the order was reviewed and priced. Re-approving
   * it is a deliberate act on a decision already made — what the rule refuses is
   * approving an order nobody ever put a number on.
   */
  it('allows approval once a quote exists, even a withdrawn one', async () => {
    const order = await createOrder();

    const quote = await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    });
    await cancelQuote(auth(ADMIN_ID, Role.ADMIN), order.id, quote.id);

    // Sending the quote already approved it; put it back under review so the
    // manual move is the thing under test.
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.UNDER_REVIEW },
    });

    const updated = await updateOrder(auth(ADMIN_ID, Role.ADMIN), order.id, {
      status: 'approved',
    });
    expect(updated.status).toBe('approved');
  });
});

/*
 * The catalog's pricing tiers, offered to the composer as quick-select lines.
 * The scoping is the part worth testing: a template for another service, or for
 * a region this order is not filed in, is exactly the mis-click a quick-select is
 * meant to prevent.
 */
describe('listQuoteTemplates', () => {
  const SERVICE_ID = 'quotes_test_service';
  const OTHER_SERVICE_ID = 'quotes_test_other_service';

  async function seedCatalog() {
    for (const [id, name] of [
      [SERVICE_ID, 'Company Formation'],
      [OTHER_SERVICE_ID, 'Bank Account'],
    ] as const) {
      await prisma.service.upsert({
        where: { id },
        create: {
          id,
          iconKey: 'default',
          name,
          description: 'Test service',
          footer: { label: 'Test' },
        },
        update: { deletedAt: null },
      });
    }

    await prisma.servicePricingTier.deleteMany({
      where: { serviceId: { in: [SERVICE_ID, OTHER_SERVICE_ID] } },
    });

    await prisma.servicePricingTier.createMany({
      data: [
        {
          serviceId: SERVICE_ID,
          name: 'Standard',
          price: 49_900,
          currency: 'USD',
          regionCode: null,
          sortOrder: 0,
        },
        {
          serviceId: SERVICE_ID,
          name: 'Expedited',
          price: 89_900,
          currency: 'USD',
          regionCode: null,
          sortOrder: 1,
        },
        // Belongs to a service this order is not for.
        {
          serviceId: OTHER_SERVICE_ID,
          name: 'Bank intro',
          price: 30_000,
          currency: 'USD',
          regionCode: null,
          sortOrder: 0,
        },
      ],
    });
  }

  async function orderForService() {
    return prisma.order.create({
      data: {
        reference: `ORD-T${Math.floor(10_000 + Math.random() * 89_999)}`,
        customerId: CUSTOMER_ID,
        status: OrderStatus.UNDER_REVIEW,
        submittedAt: new Date(),
        items: {
          create: {
            serviceId: SERVICE_ID,
            serviceName: 'Company Formation',
            answers: {},
            sortOrder: 0,
          },
        },
      },
    });
  }

  afterAll(async () => {
    /*
     * The orders go first: `order_item.serviceId` is RESTRICT, so a service
     * cannot be dropped while an item still points at it. The suite-wide
     * `afterAll` clears these too, but it runs after this one.
     */
    await prisma.quote.deleteMany({ where: { customerId: CUSTOMER_ID } });
    await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
    await prisma.servicePricingTier.deleteMany({
      where: { serviceId: { in: [SERVICE_ID, OTHER_SERVICE_ID] } },
    });
    await prisma.service.deleteMany({
      where: { id: { in: [SERVICE_ID, OTHER_SERVICE_ID] } },
    });
  });

  it('offers only the tiers for the services on the order', async () => {
    await seedCatalog();
    const order = await orderForService();

    const templates = await listQuoteTemplates(auth(ADMIN_ID, Role.ADMIN), order.id);

    expect(templates.map((t) => t.name).sort()).toEqual(['Expedited', 'Standard']);
    expect(templates.every((t) => t.serviceId === SERVICE_ID)).toBe(true);
  });

  // The price is handed through as the integer minor units it is stored as — the
  // composer converts for display, nothing here re-prices.
  it('passes the price through as integer minor units', async () => {
    await seedCatalog();
    const order = await orderForService();

    const templates = await listQuoteTemplates(auth(ADMIN_ID, Role.ADMIN), order.id);
    const standard = templates.find((t) => t.name === 'Standard');

    expect(standard?.price.amount).toBe(49_900);
    expect(standard?.price.currency).toBe('USD');
    expect(Number.isInteger(standard?.price.amount)).toBe(true);
  });

  it('excludes a tier priced for a region this order is not filed in', async () => {
    await seedCatalog();

    const region = await prisma.region.findFirst({ select: { code: true } });
    if (!region) return; // No reference regions seeded — nothing to scope against.

    await prisma.servicePricingTier.create({
      data: {
        serviceId: SERVICE_ID,
        name: 'Region-only',
        price: 12_500,
        currency: 'USD',
        regionCode: region.code,
        sortOrder: 2,
      },
    });

    // The order carries no region, so only the null-region tiers apply.
    const order = await orderForService();
    const templates = await listQuoteTemplates(auth(ADMIN_ID, Role.ADMIN), order.id);

    expect(templates.map((t) => t.name)).not.toContain('Region-only');
  });
});

describe('the customer’s view of a quote', () => {
  it('shows the quote on their order with the amounts untouched', async () => {
    const order = await createOrder();

    await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    });

    const detail = await getOrderDetail(
      reqAs(auth(CUSTOMER_ID, Role.CUSTOMER)),
      order.id,
    );

    expect(detail.quote).not.toBeNull();
    expect(detail.quote?.total.amount).toBe(57_450);
    expect(detail.quote?.payable).toBe(true);
    expect(detail.summary.total.amount).toBe(57_450);
    expect(detail.payment.fields[0]?.value).toBe('Awaiting payment');
  });

  it('reads a lapsed quote as expired without waiting for a job', async () => {
    const order = await createOrder();

    const quote = await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 1,
    });

    // Move the window into the past; the row is still PENDING.
    await prisma.quote.update({
      where: { id: quote.id },
      data: { validUntil: new Date(Date.now() - 60_000) },
    });

    const detail = await getOrderDetail(
      reqAs(auth(CUSTOMER_ID, Role.CUSTOMER)),
      order.id,
    );

    expect(detail.quote?.status).toBe('expired');
    // The offer no longer stands, so the screen must not offer to take payment.
    expect(detail.quote?.payable).toBe(false);

    const stored = await prisma.quote.findFirstOrThrow({ where: { id: quote.id } });
    expect(stored.status).toBe(QuoteStatus.PENDING);
  });

  /*
   * A second customer must not reach this order — 404 rather than 403, so the id
   * is never confirmed to someone who should not have it (guards/ownership.ts).
   * Staff are deliberately not the case under test here: they act on behalf of
   * the business and may read any customer's record, which is what the admin
   * order screen is.
   */
  it('never shows one customer another customer’s quote', async () => {
    const order = await createOrder();

    await createQuote(auth(ADMIN_ID, Role.ADMIN), order.id, {
      lineItems: LINES,
      tax: 0,
      discount: 0,
      currency: 'USD',
      validForDays: 14,
    });

    const OTHER = 'quotes_test_other_customer';
    await ensureUser(OTHER, Role.CUSTOMER);

    try {
      await expect(
        getOrderDetail(reqAs(auth(OTHER, Role.CUSTOMER)), order.id),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await prisma.user.deleteMany({ where: { id: OTHER } });
    }
  });
});
