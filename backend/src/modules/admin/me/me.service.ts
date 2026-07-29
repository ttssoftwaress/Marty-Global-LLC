import { StaffStatus } from '@prisma/client';

import type { AuthContext } from '../../../guards/index.js';
import {
  PERMISSION_AREAS,
  staffRoleLabel,
  type PermissionKey,
} from '../../../lib/permissions.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';

/*
 * Who the signed-in staff member is, as the admin shell needs them: their name,
 * their job-role label, and the permission areas they actually hold.
 *
 * This exists because the sidebar cannot be built from the auth role alone. The
 * session carries `staff` or `admin` and nothing finer, so a nav list derived
 * from it shows every section to everyone — a mail operator sees "Team & staff"
 * and gets a 403 on arrival. The grid an admin sets on the team screen is the
 * thing that decides, and it lives on StaffProfile, so the client has to be told.
 *
 * Publishing the area *keys* (not a prebuilt nav list) keeps the split the rest
 * of the module already draws: the backend owns who may see what, the frontend
 * owns what a section is called and where it routes.
 *
 * This is not a security boundary — `requirePermission` on each sub-router is.
 * Hiding a link the server would refuse anyway is a courtesy to the user, and
 * the two read the same StaffProfile row, so they cannot disagree.
 */

export type AdminMe = {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleKey: string | null;
  roleLabel: string;
  permissions: PermissionKey[];
};

const ALL_AREAS = PERMISSION_AREAS.map((area) => area.key) as PermissionKey[];

/*
 * An admin holds every area, matching `requirePermission`, which lets an admin
 * past before it ever reads a profile. Deriving this from the same rule rather
 * than from the stored list means an admin whose grid was narrowed still sees
 * the sections the guard would let them into.
 */
export async function getAdminMe(auth: AuthContext): Promise<AdminMe> {
  // The profile is fetched separately rather than nested: it is soft-deleted,
  // and Prisma allows no `where` on a to-one relation, so a nested select would
  // silently return a deleted row. `findFirst` filters it out — the same query
  // `requirePermission` runs, so the two cannot disagree about which row counts.
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, email: true },
    }),
    prisma.staffProfile.findFirst({
      where: { userId: auth.userId, deletedAt: null },
      select: { roleKey: true, status: true, permissions: true },
    }),
  ]);

  const isAdmin = auth.role === Role.ADMIN;

  // A staff member without an active profile is incompletely provisioned; the
  // safe reading of an absent grant list is "nothing", exactly as the guard
  // reads it.
  const active = profile?.status === StaffStatus.ACTIVE;
  const granted = active ? (profile?.permissions ?? []) : [];

  return {
    id: auth.userId,
    name: user?.name ?? '',
    email: user?.email ?? auth.email,
    role: auth.role,
    roleKey: profile?.roleKey ?? null,
    roleLabel: profile ? staffRoleLabel(profile.roleKey) : fallbackLabel(auth.role),
    permissions: isAdmin
      ? ALL_AREAS
      : ALL_AREAS.filter((area) => granted.includes(area)),
  };
}

// Staff with no profile row still get a label to print rather than a blank.
function fallbackLabel(role: Role): string {
  return role === Role.ADMIN ? 'Admin' : 'Staff';
}
