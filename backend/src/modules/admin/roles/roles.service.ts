import { StaffStatus, type StaffRole } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import {
  isSystemRoleKey,
  permissionAreasFor,
  permissionMap,
  SUPER_ADMIN_ROLE_KEY,
} from '../../../lib/permissions.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import {
  resolveRolePermissions,
  syncRolePermissions,
} from '../../../lib/staff-permissions.js';
import { uniqueRoleKey } from '../../../lib/staff-roles.js';
import { AuditAction, record } from '../../audit/audit.service.js';

/*
 * Job roles, as an admin defines them on the Team & staff screen. All Prisma
 * access for the roles screen lives here.
 *
 * A role is two things at once, and keeping them straight is most of this file:
 *
 *   - `permissions` — which admin sections members of this role open. This is the
 *     starting point for every member holding it, not a copy taken once: editing
 *     it here recomputes every one of them (`syncRolePermissions`), minus the
 *     keys an admin has personally overridden on an individual account.
 *   - `authRole` — the coarse Better Auth role written to those members' user
 *     rows, and the only thing the request guards actually read. Changing it
 *     rewrites every member's user row in the same transaction, because a job
 *     role and the authorization role behind it must never disagree.
 *
 * `admin` is the sharp edge here. `hasPermission` passes an admin unconditionally
 * (admin.guards.ts), so a role carrying `authRole: admin` grants every area
 * regardless of its own grid. The API says so on every row (`grantsFullAccess`)
 * so the screen can warn rather than let an admin discover it by accident.
 *
 * Every write is audited: a role edit is the widest access change in the system,
 * because it moves everyone holding it at once (AGENTS.md).
 */

export type AdminStaffRole = {
  id: string;
  key: string;
  label: string;
  authRole: Role;
  isSystem: boolean;
  /*
   * The role's own grid, area key → granted. Every catalogue key is present, so
   * a denied area is visibly denied rather than silently absent — the same shape
   * a member's map takes.
   */
  permissions: Record<string, boolean>;
  // Keys that may not be denied on this role, per member or here. Only
  // `super-admin`'s `team` uses it today.
  lockedPermissions: string[];
  memberCount: number;
  /*
   * True when `authRole` is `admin` — members of this role reach every admin
   * section whatever the grid below says, because the guards short-circuit on the
   * authorization role. Published rather than derived in the browser so the
   * warning cannot drift from the rule that causes it.
   */
  grantsFullAccess: boolean;
  // False for a system role, and for any role somebody still holds.
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

export type AdminStaffRolesView = {
  roles: AdminStaffRole[];
  // The grid's rows, so the role form renders the same table the member form
  // does. No `locked` flags: those belong to a role, and this list is the
  // catalogue every role is described against.
  permissionAreas: { key: string; label: string; scopeKey?: string }[];
  authRoleOptions: { value: Role; label: string; description: string }[];
};

const AUTH_ROLE_OPTIONS: AdminStaffRolesView['authRoleOptions'] = [
  {
    value: Role.STAFF,
    label: 'Staff',
    description:
      'Reaches only the sections switched on below. The right choice for almost every role.',
  },
  {
    value: Role.ADMIN,
    label: 'Administrator',
    description:
      'Reaches every admin section regardless of the switches, and can create and edit staff accounts.',
  },
];

function toView(
  role: StaffRole,
  memberCount: number,
): AdminStaffRole {
  const blockedReason = isSystemRoleKey(role.key)
    ? 'This is a built-in role and cannot be deleted.'
    : memberCount > 0
      ? `${memberCount} team ${memberCount === 1 ? 'member holds' : 'members hold'} this role. Move them to another role first.`
      : null;

  return {
    id: role.id,
    key: role.key,
    label: role.label,
    authRole: role.authRole === Role.ADMIN ? Role.ADMIN : Role.STAFF,
    isSystem: role.isSystem,
    permissions: permissionMap(role.permissions),
    lockedPermissions: role.lockedPermissions,
    memberCount,
    grantsFullAccess: role.authRole === Role.ADMIN,
    canDelete: blockedReason === null,
    deleteBlockedReason: blockedReason,
  };
}

// --- Read ----------------------------------------------------------------

export async function listRoles(): Promise<AdminStaffRolesView> {
  const [roles, counts] = await Promise.all([
    prisma.staffRole.findMany({
      where: LIVE,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
    prisma.staffProfile.groupBy({
      by: ['roleKey'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const countByKey = new Map(counts.map((row) => [row.roleKey, row._count._all]));

  return {
    roles: roles.map((role) => toView(role, countByKey.get(role.key) ?? 0)),
    // The catalogue with no role's locked flags applied — a role form describes
    // one role, and its own locked keys ride on the role record.
    permissionAreas: permissionAreasFor(),
    authRoleOptions: AUTH_ROLE_OPTIONS,
  };
}

/*
 * Rows not in the Trash.
 *
 * The two label-clash checks below deliberately DO carry it, unlike the
 * code-keyed tables elsewhere: a role's `label` is not unique in the database,
 * so a trashed role holding a name is not a constraint problem — it is a name
 * nobody can see, and refusing it would be refusing on the basis of a row the
 * admin has no way to find. The stable `key` is derived from the label
 * (`uniqueRoleKey`) and is what actually has to stay distinct, which that helper
 * already guarantees against every row including trashed ones.
 */
const LIVE = { deletedAt: null } as const;

// --- Create --------------------------------------------------------------

export async function createRole(
  actor: AuthContext,
  input: { label: string; authRole: Role; permissions: Record<string, boolean> },
): Promise<AdminStaffRole> {
  const label = input.label.trim();

  const clash = await prisma.staffRole.findFirst({
    where: { label: { equals: label, mode: 'insensitive' }, ...LIVE },
    select: { id: true },
  });

  if (clash) {
    throw AppError.conflict('A role with this name already exists', {
      label: 'This name is already in use',
    });
  }

  const role = await prisma.staffRole.create({
    data: {
      // Derived once and immutable: profiles and audit rows point at it, so a
      // rename must move the label and leave the identifier alone.
      key: await uniqueRoleKey(prisma, label),
      label,
      authRole: input.authRole,
      permissions: resolveRolePermissions(input.permissions, []),
      // Only the built-in roles lock anything; a role an admin defines is
      // entirely theirs to change.
      lockedPermissions: [],
      isSystem: false,
    },
  });

  void record({
    actor,
    action: AuditAction.STAFF_ROLE_CREATED,
    entityType: 'StaffRole',
    entityId: role.id,
    metadata: {
      key: role.key,
      authRole: role.authRole,
      permissions: role.permissions,
    },
  });

  return toView(role, 0);
}

// --- Update --------------------------------------------------------------

export async function updateRole(
  actor: AuthContext,
  roleId: string,
  input: {
    label?: string;
    authRole?: Role;
    permissions?: Record<string, boolean>;
  },
): Promise<AdminStaffRole> {
  const existing = await prisma.staffRole.findFirst({
    where: { id: roleId, ...LIVE },
  });

  if (!existing) throw AppError.notFound('Role not found');

  /*
   * A system role's `authRole` is fixed. The provisioner reconciles it on every
   * boot (lib/staff-roles.ts), so an edit here would be silently undone on the
   * next deploy — and `super-admin` demoted to staff is how an org loses the only
   * role that can hand access back.
   */
  if (
    input.authRole !== undefined &&
    input.authRole !== existing.authRole &&
    existing.isSystem
  ) {
    throw AppError.businessRule(
      'A built-in role’s access level cannot be changed. Create a role instead.',
    );
  }

  if (input.label !== undefined) {
    const label = input.label.trim();
    const clash = await prisma.staffRole.findFirst({
      where: {
        label: { equals: label, mode: 'insensitive' },
        id: { not: roleId },
        ...LIVE,
      },
      select: { id: true },
    });

    if (clash) {
      throw AppError.conflict('A role with this name already exists', {
        label: 'This name is already in use',
      });
    }
  }

  const nextAuthRole = (input.authRole ?? existing.authRole) as Role;

  /*
   * Dropping a role out of `admin` demotes everyone holding it in one write.
   * Counted the same way the team service counts it — auth role plus an active
   * profile, since either alone is not what grants access — because the recovery
   * from getting this wrong is a database edit, which AGENTS.md forbids.
   */
  if (existing.authRole === Role.ADMIN && nextAuthRole !== Role.ADMIN) {
    await assertRoleNotLastAdmins(existing.key);
  }

  const permissions =
    input.permissions === undefined
      ? existing.permissions
      : resolveRolePermissions(input.permissions, existing.lockedPermissions);

  const authRoleChanged = nextAuthRole !== existing.authRole;
  const permissionsChanged =
    permissions.join('|') !== existing.permissions.join('|');

  const { role, memberCount } = await prisma.$transaction(async (tx) => {
    const role = await tx.staffRole.update({
      where: { id: roleId },
      data: {
        ...(input.label === undefined ? {} : { label: input.label.trim() }),
        ...(authRoleChanged ? { authRole: nextAuthRole } : {}),
        ...(permissionsChanged ? { permissions } : {}),
      },
    });

    /*
     * The two propagations, both inside the transaction because a role that has
     * moved while its members have not is a state nothing can detect afterwards.
     */
    if (permissionsChanged) await syncRolePermissions(tx, role.key);

    if (authRoleChanged) {
      await tx.user.updateMany({
        where: { staffProfile: { is: { roleKey: role.key, deletedAt: null } } },
        data: { role: nextAuthRole },
      });
    }

    const memberCount = await tx.staffProfile.count({
      where: { roleKey: role.key, deletedAt: null },
    });

    return { role, memberCount };
  });

  void record({
    actor,
    action: AuditAction.STAFF_ROLE_UPDATED,
    entityType: 'StaffRole',
    entityId: role.id,
    metadata: {
      key: role.key,
      authRoleFrom: existing.authRole,
      authRoleTo: role.authRole,
      permissionsFrom: existing.permissions,
      permissionsTo: role.permissions,
      // How many accounts this one write moved — the figure that makes a role
      // edit readable in the trail at all.
      membersAffected: permissionsChanged || authRoleChanged ? memberCount : 0,
    },
  });

  return toView(role, memberCount);
}

/*
 * --- Delete ---------------------------------------------------------------
 *
 * Not here. A role is deleted through `modules/admin/trash`, which soft-deletes
 * the row and files a restorable entry, and both of the rules that used to sit
 * in this file — a built-in role cannot go, and neither can one any member still
 * holds — are the `staff-role` descriptor's guard in `trash.registry.ts`.
 */

// --- Shared rules --------------------------------------------------------

/*
 * Refuse a change that would leave nobody able to reach the admin-only
 * endpoints — catalog writes, transfer reconciliation, and the team screen
 * itself. The mirror of `assertNotLastAdmin` in team.service.ts, asked of a whole
 * role rather than one account.
 */
async function assertRoleNotLastAdmins(roleKey: string): Promise<void> {
  const otherAdmins = await prisma.staffProfile.count({
    where: {
      deletedAt: null,
      status: StaffStatus.ACTIVE,
      roleKey: { not: roleKey },
      user: { is: { role: Role.ADMIN, deletedAt: null } },
    },
  });

  if (otherAdmins > 0) return;

  const wouldLose = await prisma.staffProfile.count({
    where: { deletedAt: null, status: StaffStatus.ACTIVE, roleKey },
  });

  // Nobody holds it, so demoting it strands nobody.
  if (wouldLose === 0) return;

  throw AppError.businessRule(
    roleKey === SUPER_ADMIN_ROLE_KEY
      ? 'Super Admin is the last role with administrator access — another role must have it first'
      : 'This is the last role with administrator access — promote another before changing it',
  );
}
