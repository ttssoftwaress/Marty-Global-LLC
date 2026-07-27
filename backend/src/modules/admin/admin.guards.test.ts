import { StaffStatus } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '../../guards/auth-context.js';
import { SCOPED_AREAS } from '../../lib/permissions.js';
import { Role } from '../../lib/roles.js';

const { prisma } = await import('../../lib/prisma.js');
const { canSeeAll, requirePermission } = await import('./admin.guards.js');

/*
 * Per-area authorization. This guard is the only thing that makes the team
 * screen's permission grid mean anything — without it every staff member could
 * reach every admin endpoint regardless of what the grid said. These tests are
 * the ones that would catch that regressing.
 */

const ADMIN = 'guard_test_admin';
const GRANTED = 'guard_test_granted';
const DENIED = 'guard_test_denied';
const DEACTIVATED = 'guard_test_deactivated';
const NO_PROFILE = 'guard_test_no_profile';

// Data-scope fixtures: the same area, held with and without its `.all`
// companion, plus the `orders.assign` special case.
const SCOPED = 'guard_test_scoped';
const UNSCOPED = 'guard_test_unscoped';
const ASSIGNER = 'guard_test_assigner';

const IDS = [
  ADMIN,
  GRANTED,
  DENIED,
  DEACTIVATED,
  NO_PROFILE,
  SCOPED,
  UNSCOPED,
  ASSIGNER,
];

function actor(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.test`,
    emailVerified: true,
  };
}

const res = {} as Response;

// Runs the guard and resolves to whatever it passed to next(); undefined = allow.
async function run(
  guard: (req: Request, res: Response, next: NextFunction) => void | Promise<void>,
  auth: AuthContext,
): Promise<unknown> {
  const next = vi.fn();
  await guard({ auth } as unknown as Request, res, next);
  return next.mock.calls[0]?.[0];
}

async function makeStaff(
  id: string,
  role: Role,
  profile: { status: StaffStatus; permissions: string[] } | null,
) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.test`, role },
    update: { role },
  });

  if (profile) {
    await prisma.staffProfile.upsert({
      where: { userId: id },
      create: { userId: id, roleKey: 'reviewer', ...profile },
      update: profile,
    });
  }
}

beforeAll(async () => {
  await makeStaff(ADMIN, Role.ADMIN, {
    // Deliberately granted nothing: an admin must pass on their role alone.
    status: StaffStatus.ACTIVE,
    permissions: [],
  });
  await makeStaff(GRANTED, Role.STAFF, {
    status: StaffStatus.ACTIVE,
    permissions: ['orders', 'customers'],
  });
  await makeStaff(DENIED, Role.STAFF, {
    status: StaffStatus.ACTIVE,
    permissions: ['support'],
  });
  await makeStaff(DEACTIVATED, Role.STAFF, {
    status: StaffStatus.DEACTIVATED,
    // Holds the org-wide scope too: status must revoke the scope, not just the area.
    permissions: ['orders', 'payments', 'payments.all'],
  });
  await makeStaff(NO_PROFILE, Role.STAFF, null);

  // Reads the payments section, but only their own records.
  await makeStaff(SCOPED, Role.STAFF, {
    status: StaffStatus.ACTIVE,
    permissions: ['payments'],
  });
  // Same section, widened to the whole org.
  await makeStaff(UNSCOPED, Role.STAFF, {
    status: StaffStatus.ACTIVE,
    permissions: ['payments', 'payments.all'],
  });
  // Hands out work without `orders.all` — distributing filings they cannot see
  // is impossible, so the assign grant widens the orders queue by itself.
  await makeStaff(ASSIGNER, Role.STAFF, {
    status: StaffStatus.ACTIVE,
    permissions: ['orders', 'orders.assign', 'payments'],
  });
});

afterAll(async () => {
  await prisma.staffProfile.deleteMany({ where: { userId: { in: IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  await prisma.$disconnect();
});

describe('requirePermission', () => {
  it('allows a staff member granted the area', async () => {
    expect(await run(requirePermission('orders'), actor(GRANTED, Role.STAFF))).toBeUndefined();
  });

  it('rejects a staff member without the area with 403', async () => {
    expect(await run(requirePermission('orders'), actor(DENIED, Role.STAFF))).toMatchObject({
      status: 403,
    });
  });

  it('allows an admin regardless of their granted areas', async () => {
    // The admin above has an empty permission list; the role is what passes.
    expect(await run(requirePermission('payments'), actor(ADMIN, Role.ADMIN))).toBeUndefined();
  });

  it('rejects a deactivated member who still holds the grant', async () => {
    // The session outlives deactivation, so the profile status is what revokes.
    expect(
      await run(requirePermission('orders'), actor(DEACTIVATED, Role.STAFF)),
    ).toMatchObject({ status: 403 });
  });

  it('rejects a staff account with no profile at all', async () => {
    // An absent grant list reads as "denied", never "unrestricted".
    expect(
      await run(requirePermission('orders'), actor(NO_PROFILE, Role.STAFF)),
    ).toMatchObject({ status: 403 });
  });

  it('rejects a customer even if a profile somehow exists', async () => {
    expect(
      await run(requirePermission('orders'), actor(GRANTED, Role.CUSTOMER)),
    ).toMatchObject({ status: 403 });
  });
});

/*
 * The data-scope half. `requirePermission` decides whether a member reaches a
 * section; this decides whose records are in it once they do. Every scoped
 * service asks this one predicate, so a wrong answer here is not a broken
 * screen — it is one staff member reading another's customers.
 */
describe('canSeeAll', () => {
  it('passes an admin on every scoped area', async () => {
    // The admin fixture is granted nothing at all; the role is what unscopes them.
    for (const area of SCOPED_AREAS) {
      expect(await canSeeAll(actor(ADMIN, Role.ADMIN), area)).toBe(true);
    }
  });

  it('scopes a member holding the area but not its “all” companion', async () => {
    expect(await canSeeAll(actor(SCOPED, Role.STAFF), 'payments')).toBe(false);
  });

  it('unscopes a member holding both the area and its “all” companion', async () => {
    expect(await canSeeAll(actor(UNSCOPED, Role.STAFF), 'payments')).toBe(true);
  });

  it('treats orders.assign as seeing the whole orders queue', async () => {
    // Handing out filings you cannot see is impossible, so the assign grant
    // widens the queue without `orders.all`.
    expect(await canSeeAll(actor(ASSIGNER, Role.STAFF), 'orders')).toBe(true);
  });

  it('does not let the orders.assign exception leak into another area', async () => {
    // Same member, same request: assigning orders says nothing about payments.
    expect(await canSeeAll(actor(ASSIGNER, Role.STAFF), 'payments')).toBe(false);
  });

  it('revokes the scope of a deactivated member who still holds it', async () => {
    // The session outlives deactivation; the profile status is what revokes.
    expect(await canSeeAll(actor(DEACTIVATED, Role.STAFF), 'payments')).toBe(false);
  });

  it('scopes a staff account with no profile at all', async () => {
    // An absent grant list reads as "own records only", never "unrestricted".
    expect(await canSeeAll(actor(NO_PROFILE, Role.STAFF), 'orders')).toBe(false);
  });

  it('scopes a member granted the area with no scope keys anywhere', async () => {
    // The plain reviewer shape: areas, no `.all`, no assign.
    expect(await canSeeAll(actor(GRANTED, Role.STAFF), 'orders')).toBe(false);
    expect(await canSeeAll(actor(GRANTED, Role.STAFF), 'customers')).toBe(false);
  });
});
