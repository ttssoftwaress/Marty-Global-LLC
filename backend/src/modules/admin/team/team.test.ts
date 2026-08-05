import { StaffStatus } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../../guards/auth-context.js';
import { Role } from '../../../lib/roles.js';

const { prisma } = await import('../../../lib/prisma.js');
const service = await import('./team.service.js');
const trash = await import('../trash/trash.service.js');
const rolesService = await import('../roles/roles.service.js');
const { permissionMap } = await import('../../../lib/permissions.js');
const { resolveMemberPermissions } = await import('../../../lib/staff-permissions.js');

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

/*
 * A member follows their role unless told otherwise, exactly as the service
 * creates one. Writing a grant list straight onto the profile would build a row
 * the service can never produce — stored access that disagrees with the role and
 * no override saying why — and every assertion about overrides below would then
 * be measuring the fixture rather than the code.
 */
async function makeMember(
  id: string,
  role: Role,
  roleKey: string,
  status: StaffStatus,
  overrides: Record<string, boolean> = {},
) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.test`, role },
    update: { role, deletedAt: null },
  });

  const roleRow = await prisma.staffRole.findUniqueOrThrow({ where: { key: roleKey } });
  const permissions = resolveMemberPermissions(roleRow, overrides);
  const shape = { roleKey, status, permissionOverrides: overrides, permissions };

  await prisma.staffProfile.upsert({
    where: { userId: id },
    create: { userId: id, ...shape },
    update: { ...shape, deletedAt: null },
  });
}

async function cleanup() {
  // The trash entries first: a delete case files one per member, and they are
  // keyed by user id, so leaving them behind would make the next run's delete a
  // no-op against an entry that outlived its row.
  await prisma.trashEntry.deleteMany({
    where: { entityType: 'staff-member', entityId: { in: IDS } },
  });
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

/*
 * Deleting a staff account, which now runs through the Trash
 * (`modules/admin/trash`) rather than through this module.
 *
 * The refusals are the interesting cases and they are unchanged: an admin
 * locking themselves out, and the last admin being removed. Both leave an org
 * with nobody able to reach the admin-only endpoints, and the recovery is a
 * database edit — which AGENTS.md forbids.
 *
 * What did change is the successful path, and the last two cases pin it: the row
 * is soft-deleted with the login shut down immediately, not destroyed, and the
 * credential survives so that a restore inside the retention window returns
 * somebody who can still sign in.
 */
describe('deleting a staff member', () => {
  it('refuses to delete the actor’s own account', async () => {
    await expect(
      trash.trashRows(actor(ADMIN_A, Role.ADMIN), 'staff-member', [ADMIN_A]),
    ).rejects.toMatchObject({ status: 422 });

    // Still there, and still usable.
    const profile = await prisma.staffProfile.findUnique({
      where: { userId: ADMIN_A },
    });
    expect(profile?.deletedAt).toBeNull();
  });

  it('refuses to delete the last active admin', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);

    await asOnlyAdmin(ADMIN_A, async () => {
      await expect(
        trash.trashRows(actor(ADMIN_B, Role.ADMIN), 'staff-member', [ADMIN_A]),
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  it('soft-deletes and shuts the account down once another admin exists', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);

    await trash.trashRows(actor(ADMIN_B, Role.ADMIN), 'staff-member', [ADMIN_A]);

    const [profile, user, entry] = await Promise.all([
      prisma.staffProfile.findUnique({ where: { userId: ADMIN_A } }),
      prisma.user.findUnique({ where: { id: ADMIN_A } }),
      prisma.trashEntry.findUnique({
        where: {
          entityType_entityId: { entityType: 'staff-member', entityId: ADMIN_A },
        },
      }),
    ]);

    // The row survives so the delete can be taken back — but the login does not
    // wait for that window to close. A stamped `deletedAt` alone would leave a
    // credential Better Auth still signs in, which is what the ban prevents.
    expect(profile?.deletedAt).toBeInstanceOf(Date);
    expect(user?.deletedAt).toBeInstanceOf(Date);
    expect(user?.banned).toBe(true);
    expect(user?.banExpires).toBeNull();
    expect(entry).not.toBeNull();
  });

  it('keeps the credential so a restore returns a usable account', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);

    await prisma.account.create({
      data: {
        id: 'team_test_account',
        accountId: STAFF,
        providerId: 'credential',
        userId: STAFF,
        password: 'hashed',
      },
    });

    await trash.trashRows(actor(ADMIN_B, Role.ADMIN), 'staff-member', [STAFF]);

    // Destroying the password on the way in would make the restore return
    // somebody who cannot sign in — not "as it was before". It goes at purge.
    expect(await prisma.account.count({ where: { userId: STAFF } })).toBe(1);

    const entry = await prisma.trashEntry.findUniqueOrThrow({
      where: {
        entityType_entityId: { entityType: 'staff-member', entityId: STAFF },
      },
    });

    await trash.restoreEntries(actor(ADMIN_B, Role.ADMIN), [entry.id]);

    const restored = await prisma.user.findUnique({ where: { id: STAFF } });
    expect(restored?.deletedAt).toBeNull();
    expect(restored?.banned).toBe(false);
  });

  it('drops the deleted member’s sessions', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);

    await prisma.session.create({
      data: {
        id: 'team_test_session',
        token: 'team_test_token',
        userId: STAFF,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await trash.trashRows(actor(ADMIN_B, Role.ADMIN), 'staff-member', [STAFF]);

    // A cookie issued before the deletion has to be dead the moment access is
    // revoked, or the revocation means nothing. This is the one thing a restore
    // deliberately does not put back.
    expect(await prisma.session.count({ where: { userId: STAFF } })).toBe(0);
  });

  it('404s on a member who is already deleted', async () => {
    await makeMember(ADMIN_B, Role.ADMIN, 'super-admin', StaffStatus.ACTIVE);
    await trash.trashRows(actor(ADMIN_B, Role.ADMIN), 'staff-member', [STAFF]);

    await expect(
      trash.trashRows(actor(ADMIN_B, Role.ADMIN), 'staff-member', [STAFF]),
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

/*
 * The override contract, end to end against the database.
 *
 * These are the rules the whole role feature rests on, and none of them are
 * visible from the pure algebra tests in `lib/permissions.test.ts`: those prove
 * the arithmetic, these prove the storage layer actually applies it across two
 * services and a materialized column the guards read.
 */
describe('per-member permission overrides', () => {
  const ROLE_KEY = 'reviewer';

  // Put the role back after each case — it is a shared row in the test database,
  // and a widened Reviewer would leak into every later assertion.
  let originalRolePermissions: string[] = [];

  beforeEach(async () => {
    const role = await prisma.staffRole.findUniqueOrThrow({
      where: { key: ROLE_KEY },
    });
    originalRolePermissions = role.permissions;
  });

  afterEach(async () => {
    await prisma.staffRole.update({
      where: { key: ROLE_KEY },
      data: { permissions: originalRolePermissions },
    });
  });

  async function grantsOf(userId: string): Promise<string[]> {
    const profile = await prisma.staffProfile.findUniqueOrThrow({
      where: { userId },
      select: { permissions: true },
    });
    return profile.permissions;
  }

  it('stores only the keys that disagree with the role', async () => {
    const detail = await service.getTeamMember(STAFF);

    await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
      permissions: { ...detail.permissions, customers: false },
    });

    const profile = await prisma.staffProfile.findUniqueOrThrow({
      where: { userId: STAFF },
      select: { permissionOverrides: true },
    });

    // Not a copy of the whole grid — one decision about one account.
    expect(profile.permissionOverrides).toEqual({ customers: false });
    expect(await grantsOf(STAFF)).not.toContain('customers');
  });

  it('reports the denial as an override against the role', async () => {
    await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
      permissions: { ...(await service.getTeamMember(STAFF)).permissions, customers: false },
    });

    const detail = await service.getTeamMember(STAFF);

    expect(detail.overriddenPermissions).toEqual(['customers']);
    // The role still gives it — which is exactly what makes this an override
    // rather than a role that never granted it.
    expect(detail.rolePermissions['customers']).toBe(true);
    expect(detail.permissions['customers']).toBe(false);
  });

  /*
   * The requirement in one test: denying a member something keeps it denied for
   * that member and nobody else, while the role's other grants still flow.
   */
  it('keeps a denial on one account when the role is later widened', async () => {
    await makeMember(ADMIN_B, Role.STAFF, ROLE_KEY, StaffStatus.ACTIVE);

    await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
      permissions: { ...(await service.getTeamMember(STAFF)).permissions, customers: false },
    });

    // The role gains an area it never had, and keeps the one that was denied.
    await rolesService.updateRole(
      actor(ADMIN_A, Role.ADMIN),
      (await prisma.staffRole.findUniqueOrThrow({ where: { key: ROLE_KEY } })).id,
      { permissions: { ...permissionMap(originalRolePermissions), mailroom: true } },
    );

    const denied = await grantsOf(STAFF);
    const colleague = await grantsOf(ADMIN_B);

    // The overridden key stays gone for this member...
    expect(denied).not.toContain('customers');
    // ...and only this member.
    expect(colleague).toContain('customers');
    // Everything they did not override still follows the role.
    expect(denied).toContain('mailroom');
    expect(colleague).toContain('mailroom');
  });

  it('puts a member back on the role when the overrides are reset', async () => {
    await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
      permissions: { ...(await service.getTeamMember(STAFF)).permissions, customers: false },
    });

    const detail = await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
      resetPermissions: true,
    });

    expect(detail.overriddenPermissions).toEqual([]);
    expect(await grantsOf(STAFF)).toContain('customers');
  });

  /*
   * The deviations were decided against the old role's grant set, so carrying
   * them over would deny a key on a role the admin never made that decision
   * about.
   */
  it('clears the overrides when the member changes role', async () => {
    await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
      permissions: { ...(await service.getTeamMember(STAFF)).permissions, customers: false },
    });

    await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), STAFF, {
      role: 'mail-operator',
    });

    const profile = await prisma.staffProfile.findUniqueOrThrow({
      where: { userId: STAFF },
      select: { permissionOverrides: true },
    });

    expect(profile.permissionOverrides).toEqual({});
    expect(await grantsOf(STAFF)).toContain('customers');
  });

  it('refuses to deny a locked area, whatever the payload says', async () => {
    // `super-admin` locks `team` — denying it strands the account that grants
    // access back, and the recovery is a database edit.
    const detail = await service.updateTeamMember(actor(ADMIN_A, Role.ADMIN), ADMIN_A, {
      permissions: { team: false },
    });

    expect(detail.permissions['team']).toBe(true);
    expect(await grantsOf(ADMIN_A)).toContain('team');
  });
});
