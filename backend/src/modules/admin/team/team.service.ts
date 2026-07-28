import { Prisma, StaffStatus } from '@prisma/client';

import { auth } from '../../../config/auth.js';
import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { toInitials, toShortName } from '../../../lib/initials.js';
import { logger } from '../../../lib/logger.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import {
  PERMISSION_AREAS,
  findStaffRole,
  permissionAreasFor,
  permissionMap,
  resolvePermissions,
  roleOptions,
  staffRoleLabel,
} from '../../../lib/permissions.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { isoOrNull } from '../admin.views.js';
import type {
  CreateTeamMemberInput,
  ListTeamQuery,
  TeamStatusFilter,
  UpdateTeamMemberInput,
} from './team.validation.js';

/*
 * Admin team & staff. All Prisma access for these screens lives here.
 *
 * A member is a Better Auth `user` row plus the `StaffProfile` satellite: the
 * user row carries the authorization role the guards read, the profile carries
 * the job role, the account state, and the per-area grants. Both move together —
 * promoting someone to Operations Manager must also make the guards treat them
 * as an admin, or the role would be a label with no effect.
 *
 * There is no invite flow. An admin creates the login itself — name, email, and
 * the password the member signs in with — so an account is usable the moment it
 * exists and is either active or deactivated, never pending.
 *
 * Better Auth owns the credential end to end (AGENTS.md "Auth" — no custom
 * sessions or password handling): we call its create-user endpoint and its own
 * hasher, and never write a password column ourselves.
 *
 * Changing a member's role or access changes who can act on customer records and
 * money, so every write is audited (AGENTS.md).
 */

const STATUS_VIEW: Record<StaffStatus, 'active' | 'deactivated'> = {
  [StaffStatus.ACTIVE]: 'active',
  // Legacy rows seeded before the invite flow was removed still carry INVITED.
  // They read as deactivated: the account cannot be used, which is what the
  // status means to everyone looking at this screen now.
  [StaffStatus.INVITED]: 'deactivated',
  [StaffStatus.DEACTIVATED]: 'deactivated',
};

const STATUS_LABEL: Record<StaffStatus, string> = {
  [StaffStatus.ACTIVE]: 'Active',
  [StaffStatus.INVITED]: 'Deactivated',
  [StaffStatus.DEACTIVATED]: 'Deactivated',
};

// The "deactivated" filter has to catch the legacy INVITED rows too, or a row
// visible under "All" would vanish when the tab narrows to its own status.
const VIEW_TO_STATUS: Record<string, StaffStatus[]> = {
  active: [StaffStatus.ACTIVE],
  deactivated: [StaffStatus.DEACTIVATED, StaffStatus.INVITED],
};

const ACTIVE_PROFILES: Prisma.StaffProfileWhereInput = { deletedAt: null };

// --- Summary -------------------------------------------------------------
export type AdminTeamSummary = {
  totalMembers: number;
  activeMembers: number;
  deactivatedMembers: number;
  tabs: { value: TeamStatusFilter; label: string; count?: number }[];
  roles: { value: string; label: string }[];
  permissionAreas: { key: string; label: string }[];
};

export async function getSummary(): Promise<AdminTeamSummary> {
  const [totalMembers, activeMembers] = await Promise.all([
    prisma.staffProfile.count({ where: ACTIVE_PROFILES }),
    prisma.staffProfile.count({ where: { ...ACTIVE_PROFILES, status: StaffStatus.ACTIVE } }),
  ]);

  // Derived rather than counted: every profile is one or the other, so a second
  // count could only disagree with the first two under a concurrent write.
  const deactivatedMembers = totalMembers - activeMembers;

  return {
    totalMembers,
    activeMembers,
    deactivatedMembers,
    tabs: [
      { value: 'all', label: 'All', count: totalMembers },
      { value: 'active', label: 'Active', count: activeMembers },
      { value: 'deactivated', label: 'Deactivated', count: deactivatedMembers },
    ],
    // The role catalogue is server-owned; the dropdown renders what it offers.
    roles: [{ value: 'all', label: 'All roles' }, ...roleOptions()],
    /*
     * The permission grid the add-staff form renders. It ships with the summary
     * because that form has no member to fetch yet — without it the areas would
     * have to be a frontend constant, and adding an admin section would stop
     * being a backend change.
     *
     * Unlike the per-member list this one carries no `locked` flag: which areas
     * are locked depends on the role, and the role is still being chosen. The
     * service forces them on when the account is created either way.
     */
    permissionAreas: PERMISSION_AREAS.map((area) => ({
      key: area.key,
      label: area.label,
    })),
  };
}

// --- List ----------------------------------------------------------------
export type AdminTeamMemberRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  roleLabel: string;
  status: 'active' | 'deactivated';
  statusLabel: string;
  joinedAt: string | null;
};

export type AdminTeamPage = {
  members: AdminTeamMemberRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

const memberInclude = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.StaffProfileInclude;

export async function listTeam(query: ListTeamQuery): Promise<AdminTeamPage> {
  const statuses = query.status === 'all' ? undefined : VIEW_TO_STATUS[query.status];

  const where: Prisma.StaffProfileWhereInput = {
    ...ACTIVE_PROFILES,
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(query.role && query.role !== 'all' ? { roleKey: query.role } : {}),
    ...(query.search
      ? {
          user: {
            is: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        }
      : {}),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.staffProfile.count({ where }),
    prisma.staffProfile.findMany({
      where,
      include: memberInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    members: page.rows.map((profile) => ({
      // The member is addressed by their user id everywhere else in the admin
      // portal (assignees, authors), so the row carries that rather than the
      // profile's own id.
      id: profile.userId,
      name: profile.user.name,
      initials: toInitials(profile.user.name),
      email: profile.user.email,
      role: profile.roleKey,
      roleLabel: staffRoleLabel(profile.roleKey),
      status: STATUS_VIEW[profile.status],
      statusLabel: STATUS_LABEL[profile.status],
      joinedAt: isoOrNull(profile.joinedAt),
    })),
    nextCursor: page.nextCursor,
    page: query.cursor ? 0 : 1,
    totalPages: totalPages(totalResults, query.limit),
    totalResults,
  };
}

// --- Detail --------------------------------------------------------------
export type AdminTeamMemberDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  statusDescription: string;
  permissions: Record<string, boolean>;
  roles: { value: string; label: string }[];
  permissionAreas: { key: string; label: string; locked?: boolean }[];
};

// The sentence under the status switch. Kept with the backend so the wording for
// each state never has to be assembled in the browser.
const STATUS_DESCRIPTION: Record<StaffStatus, string> = {
  [StaffStatus.ACTIVE]: 'Active — the account is fully active and enabled.',
  [StaffStatus.INVITED]:
    'Deactivated — the account cannot sign in or act on any record.',
  [StaffStatus.DEACTIVATED]:
    'Deactivated — the account cannot sign in or act on any record.',
};

function toDetail(profile: {
  userId: string;
  roleKey: string;
  status: StaffStatus;
  permissions: string[];
  user: { name: string; email: string };
}): AdminTeamMemberDetail {
  return {
    id: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    role: profile.roleKey,
    isActive: profile.status === StaffStatus.ACTIVE,
    statusDescription: STATUS_DESCRIPTION[profile.status],
    permissions: permissionMap(profile.permissions),
    roles: roleOptions(),
    permissionAreas: permissionAreasFor(profile.roleKey),
  };
}

export async function getTeamMember(userId: string): Promise<AdminTeamMemberDetail> {
  const profile = await prisma.staffProfile.findFirst({
    where: { userId, ...ACTIVE_PROFILES },
    include: memberInclude,
  });

  if (!profile) throw AppError.notFound('Team member not found');
  return toDetail(profile);
}

// --- Create --------------------------------------------------------------

/*
 * Create a staff login.
 *
 * Better Auth mints the user row and hashes the password through its own
 * create-user endpoint — the same path `auth/admin-bootstrap.service.ts` takes,
 * and for the same reason: we never hash or store a credential ourselves. The
 * endpoint permits a session-less server-side call, so no headers are passed;
 * this route's own `requireAdmin` guard is what authorizes it.
 *
 * The account is verified on creation. A staff member is provisioned by an
 * admin rather than signing up, so there is no verification email to act on and
 * `requireVerifiedEmail` would otherwise lock them out of the portal they were
 * just given access to.
 */
export async function createTeamMember(
  actor: AuthContext,
  input: CreateTeamMemberInput,
): Promise<AdminTeamMemberDetail> {
  const roleDefinition = findStaffRole(input.role);

  if (!roleDefinition) {
    throw AppError.validation('Unknown role', { role: input.role });
  }

  // Better Auth lowercases on create; match on the same form so the duplicate
  // check and the row it protects agree.
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict('An account with this email already exists', {
      email: 'This email is already in use',
    });
  }

  // Untouched grid → the role's defaults. The resolver forces the role's locked
  // areas on either way, so a submitted map is still only a request.
  const permissions = resolvePermissions(
    input.role,
    input.permissions ?? permissionMap(roleDefinition.defaults),
  );

  /*
   * The role is set below rather than passed here. The admin plugin types its
   * `role` param as its own built-in literals, which do not include our `staff`
   * role — the column itself is free-form (lib/roles.ts), so the authorization
   * role is written in the same transaction as the profile, where the two
   * already have to move together.
   */
  const { user } = await auth.api.createUser({
    body: { email, password: input.password, name: input.name },
  });

  const status = input.isActive ? StaffStatus.ACTIVE : StaffStatus.DEACTIVATED;

  /*
   * The user row now exists but is not yet staff in our own tables — Better Auth
   * defaults it to `customer`. If the profile write fails the account would be a
   * credential with no staff role and no grants, which is a half-provisioned
   * login. Roll the user row back so the admin can simply retry.
   */
  try {
    const profile = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        // The job role decides the authorization role the guards read.
        data: { emailVerified: true, role: roleDefinition.authRole },
      });

      return tx.staffProfile.create({
        data: {
          userId: user.id,
          roleKey: input.role,
          status,
          permissions,
          shortName: toShortName(input.name),
          // The admin created the login outright, so this is the join date —
          // there is no invitation to accept.
          joinedAt: new Date(),
        },
        include: memberInclude,
      });
    });

    void record({
      actor,
      action: AuditAction.STAFF_CREATED,
      entityType: 'StaffProfile',
      entityId: user.id,
      // Role, status, and the granted key set — never the name, email, or
      // password (AGENTS.md, Security & PII).
      metadata: { role: input.role, status, permissions },
    });

    return toDetail(profile);
  } catch (error) {
    await prisma.user
      .delete({ where: { id: user.id } })
      .catch((cleanupError: unknown) => {
        logger.error(
          { err: cleanupError, userId: user.id },
          'Failed to roll back a half-provisioned staff account',
        );
      });

    throw error;
  }
}

// --- Write ---------------------------------------------------------------
export async function updateTeamMember(
  actor: AuthContext,
  userId: string,
  input: UpdateTeamMemberInput,
): Promise<AdminTeamMemberDetail> {
  const profile = await prisma.staffProfile.findFirst({
    where: { userId, ...ACTIVE_PROFILES },
    include: memberInclude,
  });

  if (!profile) throw AppError.notFound('Team member not found');

  const roleKey = input.role ?? profile.roleKey;
  const roleDefinition = findStaffRole(roleKey);

  if (!roleDefinition) {
    throw AppError.validation('Unknown role', { role: roleKey });
  }

  /*
   * An admin may not deactivate or demote themselves. Both are how the last
   * account able to restore access locks itself out, and the recovery is a
   * database edit — which AGENTS.md forbids. Refusing here is cheaper than that.
   */
  if (userId === actor.userId) {
    if (input.isActive === false) {
      throw AppError.businessRule('You cannot deactivate your own account');
    }
    if (input.role && input.role !== profile.roleKey) {
      throw AppError.businessRule('You cannot change your own role');
    }
  }

  if (input.email !== undefined) {
    const email = input.email.toLowerCase();
    const clash = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (clash && clash.id !== userId) {
      throw AppError.conflict('An account with this email already exists', {
        email: 'This email is already in use',
      });
    }
  }

  const nextStatus =
    input.isActive === undefined
      ? profile.status
      : input.isActive
        ? StaffStatus.ACTIVE
        : StaffStatus.DEACTIVATED;

  /*
   * Demoting the last active admin would leave nobody able to reach the
   * admin-only endpoints — catalog writes, transfer reconciliation, this very
   * screen. Counted across both the auth role and an active profile, since
   * either alone is not what actually grants access.
   */
  const losingAdmin =
    findStaffRole(profile.roleKey)?.authRole === 'admin' &&
    (roleDefinition.authRole !== 'admin' || nextStatus !== StaffStatus.ACTIVE);

  if (losingAdmin) {
    await assertNotLastAdmin(userId);
  }

  // Locked areas are forced on and unknown keys dropped (lib/permissions.ts).
  const permissions = resolvePermissions(
    roleKey,
    input.permissions ?? permissionMap(profile.permissions),
  );

  // One transaction: the auth role and the job role must never disagree, or a
  // member would hold a title the guards do not honour.
  const updated = await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.email !== undefined || input.role !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.email === undefined ? {} : { email: input.email.toLowerCase() }),
          // The job role decides the authorization role.
          ...(input.role === undefined ? {} : { role: roleDefinition.authRole }),
        },
      });
    }

    return tx.staffProfile.update({
      where: { userId },
      data: {
        roleKey,
        status: nextStatus,
        permissions,
        ...(input.name === undefined ? {} : { shortName: toShortName(input.name) }),
      },
      include: memberInclude,
    });
  });

  // After the record write, so a failed save never leaves the member holding a
  // password that does not match what the screen reported.
  if (input.password !== undefined) {
    await setPassword(userId, input.password);
  }

  void record({
    actor,
    action: AuditAction.STAFF_UPDATED,
    entityType: 'StaffProfile',
    entityId: userId,
    // Role, status, and the granted key set — no name or email, which are PII,
    // and the password only as the fact that it changed.
    metadata: {
      roleFrom: profile.roleKey,
      roleTo: roleKey,
      statusFrom: profile.status,
      statusTo: nextStatus,
      permissionsFrom: profile.permissions,
      permissionsTo: permissions,
      passwordReset: input.password !== undefined,
    },
  });

  return toDetail(updated);
}

// --- Delete --------------------------------------------------------------

/*
 * Delete a staff account.
 *
 * Soft delete, per AGENTS.md ("Customer-facing records soft-delete via
 * `deletedAt`… ask before any hard delete"). A staff member authors order
 * activity, processes mail requests, and appears as an assignee on rows that
 * carry regulatory retention — hard-deleting the user row would either orphan
 * or cascade those. The profile and the user row are both stamped, so the
 * member leaves every admin list and can no longer be assigned work.
 *
 * The sessions are hard-deleted, and that is the point: `deletedAt` alone would
 * leave a signed-in member with a live cookie, and a session row carries no
 * history worth keeping. Deleting them is what actually ends the access.
 */
export async function deleteTeamMember(
  actor: AuthContext,
  userId: string,
): Promise<{ id: string }> {
  const profile = await prisma.staffProfile.findFirst({
    where: { userId, ...ACTIVE_PROFILES },
    select: { roleKey: true, status: true, permissions: true },
  });

  if (!profile) throw AppError.notFound('Team member not found');

  // Same reasoning as the update guard: an admin deleting their own account is
  // the fastest way to strand the org, and there is no undo through the portal.
  if (userId === actor.userId) {
    throw AppError.businessRule('You cannot delete your own account');
  }

  if (findStaffRole(profile.roleKey)?.authRole === 'admin') {
    await assertNotLastAdmin(userId);
  }

  const deletedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.staffProfile.update({ where: { userId }, data: { deletedAt } });
    await tx.user.update({ where: { id: userId }, data: { deletedAt } });
    await tx.session.deleteMany({ where: { userId } });
  });

  void record({
    actor,
    action: AuditAction.STAFF_DELETED,
    entityType: 'StaffProfile',
    entityId: userId,
    metadata: {
      role: profile.roleKey,
      status: profile.status,
      permissions: profile.permissions,
    },
  });

  return { id: userId };
}

// --- Shared rules --------------------------------------------------------

/*
 * Refuse a change that would remove the last account able to reach the
 * admin-only endpoints — catalog writes, transfer reconciliation, and this
 * screen itself. Counted across both the auth role and an active profile, since
 * either alone is not what actually grants access.
 */
async function assertNotLastAdmin(excludingUserId: string): Promise<void> {
  const otherAdmins = await prisma.staffProfile.count({
    where: {
      ...ACTIVE_PROFILES,
      status: StaffStatus.ACTIVE,
      userId: { not: excludingUserId },
      user: { is: { role: 'admin', deletedAt: null } },
    },
  });

  if (otherAdmins === 0) {
    throw AppError.businessRule(
      'This is the last active admin — promote another before changing this one',
    );
  }
}

/*
 * Reset a member's sign-in password through Better Auth's own hasher, linking a
 * credential account if the row somehow has none (a user seeded without one).
 * Mirrors `auth/admin-bootstrap.service.ts` — we never write the column
 * ourselves (AGENTS.md, Auth).
 */
async function setPassword(userId: string, password: string): Promise<void> {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const credential = accounts.find((account) => account.providerId === 'credential');

  if (credential) {
    await ctx.internalAdapter.updatePassword(userId, hash);
    return;
  }

  await ctx.internalAdapter.linkAccount({
    accountId: userId,
    providerId: 'credential',
    password: hash,
    userId,
  });
}
