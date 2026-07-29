import { StaffStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../../guards/auth-context.js';
import { Role } from '../../../lib/roles.js';

const { prisma } = await import('../../../lib/prisma.js');
const service = await import('./team.service.js');

/*
 * The team module's refusals.
 *
 * Creating and deleting a staff login is how admin access is handed out and
 * taken away, so the interesting cases are the ones the service must refuse: an
 * admin locking themselves out, and the last admin being removed. Those leave an
 * org with nobody able to reach the admin-only endpoints, and the recovery is a
 * database edit — which AGENTS.md forbids. The happy path is not covered here
 * because it calls Better Auth's create-user endpoint, which needs a real auth
 * context; the refusals all decide before that call.
 */

const ADMIN_A = 'team_test_admin_a';
const ADMIN_B = 'team_test_admin_b';
const STAFF = 'team_test_staff';

const IDS = [ADMIN_A, ADMIN_B, STAFF];

function actor(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.test`,
    emailVerified: true,
  };
}

async function makeMember(
  id: string,
  role: Role,
  roleKey: string,
  status: StaffStatus,
) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.test`, role },
    update: { role, deletedAt: null },
  });

  await prisma.staffProfile.upsert({
    where: { userId: id },
    create: { userId: id, roleKey, status, permissions: ['team'] },
    update: { roleKey, status, permissions: ['team'], deletedAt: null },
  });
}

async function cleanup() {
  await prisma.staffProfile.deleteMany({ where: { userId: { in: IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
}

/*
 * Make the fixture admin genuinely the last one.
 *
 * The last-admin rule counts every active admin in the database, and the shared
 * test Postgres already holds the bootstrap admin plus seeded demo staff — so a
 * fixture admin is never actually last unless the others are stood down first.
 * They are parked as DEACTIVATED rather than deleted (the seed owns those rows)
 * and restored by the returned undo, so the suite leaves the database as it
 * found it.
 */
async function asOnlyAdmin<T>(keepUserId: string, run: () => Promise<T>): Promise<T> {
  const others = await prisma.staffProfile.findMany({
    where: {
      deletedAt: null,
      status: StaffStatus.ACTIVE,
      userId: { not: keepUserId },
      user: { is: { role: Role.ADMIN, deletedAt: null } },
    },
    select: { userId: true },
  });

  const ids = others.map((profile) => profile.userId);

  await prisma.staffProfile.updateMany({
    where: { userId: { in: ids } },
    data: { status: StaffStatus.DEACTIVATED },
  });

  try {
    return await run();
  } finally {
    await prisma.staffProfile.updateMany({
      where: { userId: { in: ids } },
      data: { status: StaffStatus.ACTIVE },
    });
  }
}

beforeEach(async () => {
  await cleanup();
  await makeMember(ADMIN_A, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);
  await makeMember(STAFF, Role.STAFF, 'reviewer', StaffStatus.ACTIVE);
});

afterAll(cleanup);

describe('deleteTeamMember', () => {
  it('refuses to delete the actor’s own account', async () => {
    await expect(
      service.deleteTeamMember(actor(ADMIN_A, Role.ADMIN), ADMIN_A),
    ).rejects.toMatchObject({ status: 422 });

    // Still there, and still usable.
    const profile = await prisma.staffProfile.findUnique({
      where: { userId: ADMIN_A },
    });
    expect(profile?.deletedAt).toBeNull();
  });

  it('refuses to delete the last active admin', async () => {
    await asOnlyAdmin(ADMIN_A, async () => {
      await expect(
        service.deleteTeamMember(actor(STAFF, Role.STAFF), ADMIN_A),
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  it('deletes an admin once another active admin exists', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);

    await service.deleteTeamMember(actor(ADMIN_B, Role.ADMIN), ADMIN_A);

    const [profile, user] = await Promise.all([
      prisma.staffProfile.findUnique({ where: { userId: ADMIN_A } }),
      prisma.user.findUnique({ where: { id: ADMIN_A } }),
    ]);

    // Soft-deleted on both rows, so the member leaves every admin list while
    // the work they authored stays attributed (AGENTS.md, retention).
    expect(profile?.deletedAt).toBeInstanceOf(Date);
    expect(user?.deletedAt).toBeInstanceOf(Date);
  });

  it('drops the deleted member’s sessions, not just the record', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);

    await prisma.session.create({
      data: {
        id: 'team_test_session',
        token: 'team_test_token',
        userId: STAFF,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await service.deleteTeamMember(actor(ADMIN_B, Role.ADMIN), STAFF);

    // `deletedAt` alone would leave a signed-in member holding a live cookie.
    expect(await prisma.session.count({ where: { userId: STAFF } })).toBe(0);
  });

  it('404s on a member who is already deleted', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);
    await service.deleteTeamMember(actor(ADMIN_B, Role.ADMIN), STAFF);

    await expect(
      service.deleteTeamMember(actor(ADMIN_B, Role.ADMIN), STAFF),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('createTeamMember', () => {
  it('rejects an unknown role before touching the auth provider', async () => {
    await expect(
      service.createTeamMember(actor(ADMIN_A, Role.ADMIN), {
        name: 'New Person',
        email: 'new.person@example.test',
        password: 'a-long-enough-password',
        role: 'not-a-real-role',
        isActive: true,
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(
      await prisma.user.count({ where: { email: 'new.person@example.test' } }),
    ).toBe(0);
  });

  it('rejects an email already in use', async () => {
    await expect(
      service.createTeamMember(actor(ADMIN_A, Role.ADMIN), {
        name: 'Duplicate',
        // Upper-cased: the check must match the lowercased form Better Auth
        // stores, or a duplicate would slip through to a unique-constraint crash.
        email: `${STAFF}@EXAMPLE.TEST`,
        password: 'a-long-enough-password',
        role: 'reviewer',
        isActive: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('updateTeamMember', () => {
  it('refuses to deactivate the actor’s own account', async () => {
    await expect(
      service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), ADMIN_A, {
        isActive: false,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('refuses to demote the last active admin', async () => {
    await asOnlyAdmin(ADMIN_A, async () => {
      await expect(
        service.updateTeamMember(actor(STAFF, Role.STAFF), ADMIN_A, {
          role: 'reviewer',
        }),
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  it('moves the auth role with the job role', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);

    await service.updateTeamMember(actor(ADMIN_B, Role.ADMIN), STAFF, {
      role: 'operations-manager',
    });

    // An Operations Manager carries the admin auth role — otherwise the title
    // would be a label the guards do not honour.
    const user = await prisma.user.findUnique({ where: { id: STAFF } });
    expect(user?.role).toBe(Role.ADMIN);
  });

  it('rejects an email already used by another member', async () => {
    await expect(
      service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
        email: `${ADMIN_A}@example.test`,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('listTeam', () => {
  it('counts a legacy INVITED row as deactivated', async () => {
    // Rows seeded before the invite flow was removed still carry the status.
    // They must appear under the "deactivated" tab, not vanish from every tab.
    await prisma.staffProfile.update({
      where: { userId: STAFF },
      data: { status: StaffStatus.INVITED },
    });

    const page = await service.listTeam({
      status: 'deactivated',
      limit: 20,
    });

    const row = page.members.find((member) => member.id === STAFF);
    expect(row?.status).toBe('deactivated');
    expect(row?.statusLabel).toBe('Deactivated');
  });
});
