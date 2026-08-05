import { Prisma, StaffStatus } from '@prisma/client';

import { auth } from '../../../config/auth.js';
import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { toInitials, toShortName } from '../../../lib/initials.js';
import { logger } from '../../../lib/logger.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import {
  overridesFor,
  parseOverrides,
  permissionAreasFor,
  permissionMap,
  type PermissionOverrides,
} from '../../../lib/permissions.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { resolveMemberPermissions } from '../../../lib/staff-permissions.js';
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
 * THE PERMISSION SWITCHES ARE AN OVERRIDE, NOT A COPY
 *
 * A member's access is their role's grant set with their own deviations applied
 * on top. The switches on the edit screen show the effective answer — what this
 * person can actually reach — and saving them stores only the keys that disagree
 * with the role (`permissionOverrides`).
 *
 * That distinction is the whole point. Denying one reviewer `payments` takes it
 * from that account and no other, and it survives the role being edited later.
 * A key left agreeing with the role carries no override, so a role edit moves it
 * — which is what makes roles worth defining at all. `lib/staff-permissions.ts`
 * owns both directions.
 *
 * Changing a member's *role* clears their overrides: the deviations were decided
 * against a different grant set, and carrying "denied payments" across to a role
 * that never gave payments would silently deny it again if the new role ever
 * gained it.
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

// The columns every screen here needs off a role: what it grants, what it forces
// on, and what to print.
const roleSelect = {
  key: true,
  label: true,
  authRole: true,
  permissions: true,
  lockedPermissions: true,
} satisfies Prisma.StaffRoleSelect;

// --- Summary -------------------------------------------------------------
export type AdminTeamSummary = {
  totalMembers: number;
  activeMembers: number;
  deactivatedMembers: number;
  tabs: { value: TeamStatusFilter; label: string; count?: number }[];
  roles: { value: string; label: string }[];
  permissionAreas: { key: string; label: string; scopeKey?: string }[];
  /*
   * Each role's own grant set, keyed by role key. The add-staff form needs it to
   * seed the grid the moment the admin picks a role — without it the switches
   * would open blank and the first save would deny everything the role gives.
   *
   * It also lets the form mark a switch the admin has moved away from the role's
   * default, which is the only way "this is an override" is visible before the
   * account exists.
   */
  rolePermissions: Record<string, Record<string, boolean>>;
  // Roles whose members bypass the grid entirely — `authRole: admin`, which
  // `hasPermission` short-circuits (admin.guards.ts). The form says so.
  fullAccessRoles: string[];
};

export async function getSummary(): Promise<AdminTeamSummary> {
  const [totalMembers, activeMembers, roles] = await Promise.all([
    prisma.staffProfile.count({ where: ACTIVE_PROFILES }),
    prisma.staffProfile.count({ where: { ...ACTIVE_PROFILES, status: StaffStatus.ACTIVE } }),
    prisma.staffRole.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: roleSelect,
    }),
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
    // Admin-defined now, so the dropdown renders the rows rather than a
    // hardcoded catalogue.
    roles: [
      { value: 'all', label: 'All roles' },
      ...roles.map((role) => ({ value: role.key, label: role.label })),
    ],
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
    permissionAreas: permissionAreasFor(),
    rolePermissions: Object.fromEntries(
      roles.map((role) => [role.key, permissionMap(role.permissions)]),
    ),
    fullAccessRoles: roles
      .filter((role) => role.authRole === Role.ADMIN)
      .map((role) => role.key),
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
  // Joined rather than looked up from a code catalogue: the label an admin gave
  // the role is the label the row prints, and the grants are what the detail
  // screen resolves the member's effective access against.
  role: { select: roleSelect },
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
      roleLabel: profile.role.label,
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
  roleLabel: string;
  isActive: boolean;
  statusDescription: string;
  /*
   * The effective grid — what this member can actually reach, which is what the
   * switches show and what the admin edits. Role grants with this member's own
   * overrides applied on top.
   */
  permissions: Record<string, boolean>;
  /*
   * What the role alone gives, so the screen can mark every switch the admin has
   * moved away from it and offer to put it back. Without this the override is
   * invisible: a denied switch and a switch the role never granted look the same.
   */
  rolePermissions: Record<string, boolean>;
  // The keys that currently carry a decision about this account specifically.
  // Derived from the two maps above, but sent rather than diffed in the browser
  // so "is this overridden" has one definition.
  overriddenPermissions: string[];
  /*
   * True when the role's `authRole` is `admin`: the guards short-circuit on the
   * authorization role, so this member reaches every section whatever the grid
   * says. The screen warns rather than letting an admin find out by accident.
   */
  roleGrantsFullAccess: boolean;
  roles: { value: string; label: string }[];
  permissionAreas: { key: string; label: string; scopeKey?: string; locked?: boolean }[];
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

type MemberRecord = {
  userId: string;
  roleKey: string;
  status: StaffStatus;
  permissions: string[];
  user: { name: string; email: string };
  role: {
    label: string;
    authRole: string;
    permissions: string[];
    lockedPermissions: string[];
  };
};

function toDetail(
  profile: MemberRecord,
  roles: { key: string; label: string }[],
): AdminTeamMemberDetail {
  const effective = permissionMap(profile.permissions);
  const fromRole = permissionMap(profile.role.permissions);

  return {
    id: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    role: profile.roleKey,
    roleLabel: profile.role.label,
    isActive: profile.status === StaffStatus.ACTIVE,
    statusDescription: STATUS_DESCRIPTION[profile.status],
    permissions: effective,
    rolePermissions: fromRole,
    /*
     * Compared against the *materialized* set rather than against the stored
     * override map, so a key that was overridden to a value the role has since
     * caught up with stops reading as an override — the screen shows deviations
     * that still make a difference, not the history of how they got there.
     */
    overriddenPermissions: Object.keys(effective).filter(
      (key) => effective[key] !== fromRole[key],
    ),
    roleGrantsFullAccess: profile.role.authRole === Role.ADMIN,
    roles: roles.map((role) => ({ value: role.key, label: role.label })),
    permissionAreas: permissionAreasFor(profile.role.lockedPermissions),
  };
}

// The dropdown's options, in the order the roles screen lists them.
function listRoleOptions() {
  return prisma.staffRole.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { key: true, label: true },
  });
}

export async function getTeamMember(userId: string): Promise<AdminTeamMemberDetail> {
  const [profile, roles] = await Promise.all([
    prisma.staffProfile.findFirst({
      where: { userId, ...ACTIVE_PROFILES },
      include: memberInclude,
    }),
    listRoleOptions(),
  ]);

  if (!profile) throw AppError.notFound('Team member not found');
  return toDetail(profile, roles);
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
  const role = await prisma.staffRole.findFirst({
    where: { key: input.role, deletedAt: null },
    select: roleSelect,
  });

  if (!role) {
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

  /*
   * An untouched grid means the role's own set, which produces no overrides at
   * all — the account simply follows its role, and a later role edit reaches it.
   * A grid the admin adjusted is diffed against the role, so only what they
   * actually changed is recorded as this account's own decision.
   */
  const overrides =
    input.permissions === undefined
      ? {}
      : overridesFor({
          rolePermissions: role.permissions,
          submitted: input.permissions,
          locked: role.lockedPermissions,
        });

  const permissions = resolveMemberPermissions(role, overrides);

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
        data: { emailVerified: true, role: role.authRole },
      });

      return tx.staffProfile.create({
        data: {
          userId: user.id,
          roleKey: input.role,
          status,
          permissionOverrides: overrides,
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
      // Role, status, the granted key set, and which of those keys were decided
      // for this account rather than inherited — never the name, email, or
      // password (AGENTS.md, Security & PII).
      metadata: { role: input.role, status, permissions, overrides },
    });

    return toDetail(profile, await listRoleOptions());
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
  const roleChanged = roleKey !== profile.roleKey;

  const role = roleChanged
    ? await prisma.staffRole.findFirst({
        // A submitted key, so a trashed role must be refused rather than
        // assigned — the member would otherwise hold a role nobody can see or
        // edit, and a restore would silently re-expose it.
        where: { key: roleKey, deletedAt: null },
        select: roleSelect,
      })
    : profile.role;

  if (!role) {
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
    profile.role.authRole === Role.ADMIN &&
    (role.authRole !== Role.ADMIN || nextStatus !== StaffStatus.ACTIVE);

  if (losingAdmin) {
    await assertNotLastAdmin(userId);
  }

  /*
   * What this account decides for itself, after the save.
   *
   * Three cases, and the order matters:
   *   - `resetPermissions` clears every override outright, putting the member
   *     back on exactly what their role gives.
   *   - a role change clears them too. The deviations were decided against the
   *     old role's grant set, and "denied payments" carried onto a role that
   *     never gave payments would lie dormant and deny it if the role later
   *     gained it. Whatever grid the form sent came from the old role, so it is
   *     not a statement about the new one either.
   *   - otherwise the submitted grid is diffed against the role. A switch left
   *     agreeing with the role records nothing and keeps following it; a switch
   *     the admin moved is stored, and stays put when the role changes later.
   */
  const overrides: PermissionOverrides =
    input.resetPermissions || roleChanged
      ? {}
      : input.permissions === undefined
        ? parseOverrides(profile.permissionOverrides)
        : overridesFor({
            rolePermissions: role.permissions,
            submitted: input.permissions,
            locked: role.lockedPermissions,
          });

  const permissions = resolveMemberPermissions(role, overrides);

  // One transaction: the auth role and the job role must never disagree, or a
  // member would hold a title the guards do not honour.
  const updated = await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.email !== undefined || roleChanged) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.email === undefined ? {} : { email: input.email.toLowerCase() }),
          // The job role decides the authorization role.
          ...(roleChanged ? { role: role.authRole } : {}),
        },
      });
    }

    return tx.staffProfile.update({
      where: { userId },
      data: {
        roleKey,
        status: nextStatus,
        permissionOverrides: overrides,
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
      // The deviations from the role, separately from the effective set: a
      // reader six months later needs to know whether a member reached something
      // because their role gives it or because somebody decided it for them.
      overridesFrom: parseOverrides(profile.permissionOverrides),
      overridesTo: overrides,
      passwordReset: input.password !== undefined,
    },
  });

  return toDetail(updated, await listRoleOptions());
}

// --- Delete --------------------------------------------------------------

/*
 * --- Delete ---------------------------------------------------------------
 *
 * Not here any more. A staff account is deleted through `modules/admin/trash`,
 * and every rule that used to live in this file moved with it, onto the
 * `staff-member` descriptor in `trash.registry.ts`:
 *
 *   - You cannot delete your own account. There is no undo through the portal
 *     for locking yourself out, and the Trash is not one — the restore button is
 *     behind the access the delete would remove.
 *   - You cannot remove the last active admin (`assertNotLastAdmin` below is
 *     still the definition; the guard calls the same question).
 *   - An account that owns customer records is revoked, never dropped. Those
 *     foreign keys cascade from `user`, so deleting the row would take orders,
 *     quotes, and payments with it — records AGENTS.md puts under retention.
 *     That check is now a `purgeGuard`, asked at the end of the retention window
 *     rather than at the start of it.
 *
 * What the descriptor does differently, deliberately: the credential `Account`
 * row survives the soft delete. Access still ends immediately — the ban and the
 * dropped sessions see to that — but destroying the password on the way in would
 * make a restore return somebody who cannot sign in, which is not the "as it was
 * before" the feature promises. The credential goes at purge, with the row.
 */

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
