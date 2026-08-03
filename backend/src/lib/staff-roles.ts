import type { PrismaClient } from '@prisma/client';

import { sanitizePermissionKeys, SYSTEM_STAFF_ROLES } from './permissions.js';

/*
 * Provision the five built-in job roles.
 *
 * Roles are data now — an admin creates and edits them on the Team & staff
 * screen — but an empty install has to start with something, or the first
 * "Add staff member" would have no role to offer and the bootstrap admin no
 * profile to hold.
 *
 * Create-only, deliberately. An existing row is left exactly as it is, including
 * its label and its grant set: an admin who narrowed "Support Agent" should not
 * find it widened again after a deploy. What a system role *is* — its key, that
 * it cannot be deleted, and which auth role it maps to — is still code, and
 * `authRole` is reconciled below because that one is a correctness property
 * rather than a preference: a role whose members are written to the user row as
 * `admin` must keep saying so.
 *
 * Idempotent, so `server.ts` runs it on every boot alongside the admin-account
 * bootstrap. The client is passed in rather than imported so the seed — which
 * runs with its own client and without the full validated env — can call it too.
 */

type RoleClient = Pick<PrismaClient, 'staffRole'>;

export async function ensureSystemStaffRoles(db: RoleClient): Promise<void> {
  for (const role of SYSTEM_STAFF_ROLES) {
    const permissions = sanitizePermissionKeys(role.permissions, role.locked);

    const created = await db.staffRole.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        label: role.label,
        authRole: role.authRole,
        permissions,
        lockedPermissions: [...role.locked],
        isSystem: true,
        sortOrder: role.sortOrder,
      },
      // Only the properties an admin may not edit are reconciled. `label`,
      // `permissions`, and `sortOrder` are theirs to change and are not touched.
      update: {
        authRole: role.authRole,
        lockedPermissions: [...role.locked],
        isSystem: true,
      },
    });

    /*
     * A locked key edited off the role's own grant set would leave the role
     * claiming to force something it does not hold. Cheap to repair, and a no-op
     * after the first boot.
     */
    const repaired = sanitizePermissionKeys(created.permissions, role.locked);

    if (repaired.length !== created.permissions.length) {
      await db.staffRole.update({
        where: { key: role.key },
        data: { permissions: repaired },
      });
    }
  }
}

/*
 * Turn an admin's role name into a stable key.
 *
 * The key is what StaffProfile stores and what audit entries record, so it is
 * fixed at creation and never follows a later rename — the label is the thing
 * that moves. A collision gets a numeric suffix rather than an error: two roles
 * named "Reviewer" is a reasonable thing for an org to want, and refusing the
 * second over an identifier the admin never sees would be a confusing failure.
 */
export function roleKeyFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  // A label of only punctuation still needs an identifier.
  return slug || 'role';
}

export async function uniqueRoleKey(
  db: RoleClient,
  label: string,
): Promise<string> {
  const base = roleKeyFromLabel(label);

  const taken = new Set(
    (
      await db.staffRole.findMany({
        where: { key: { startsWith: base } },
        select: { key: true },
      })
    ).map((role) => role.key),
  );

  if (!taken.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error(`Could not derive a unique role key from "${label}"`);
}
