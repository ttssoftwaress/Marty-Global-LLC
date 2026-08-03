import type { Prisma } from '@prisma/client';

import {
  effectivePermissions,
  parseOverrides,
  sanitizePermissionKeys,
  type PermissionKey,
  type PermissionOverrides,
} from './permissions.js';

/*
 * The bridge between the pure algebra in `lib/permissions.ts` and what is stored
 * on a StaffProfile.
 *
 * A member's access is `role.permissions` with their own `permissionOverrides`
 * applied on top. That is a derived value, but `StaffProfile.permissions` holds
 * it materialized, for two reasons that both come from the read side:
 *
 *   - `admin.guards.ts` resolves it on every admin request. Deriving it would put
 *     a join on the hot path of every guard call.
 *   - Two assignee pickers filter on it in SQL — `permissions: { has: 'orders' }`
 *     in `admin/orders`, `{ has: 'support' }` in `admin/support`. Set arithmetic
 *     against a role's array is not expressible in a Prisma `where`, so a derived
 *     column would force those two queries to load every staff row and filter in
 *     Node.
 *
 * The cost of materializing is that every write which can change the answer has
 * to recompute — including a *role* edit, which changes it for everyone holding
 * that role. `syncRolePermissions` below is that path, and it is the reason a
 * role edit is a transaction rather than a single update.
 *
 * Nothing here imports `lib/prisma.js`: the client comes in as an argument. That
 * keeps the module usable from `prisma/seed-admin-demo.ts`, which runs with its
 * own client and without the full validated env that `config/env.ts` demands.
 */

type RoleGrants = {
  permissions: string[];
  lockedPermissions: string[];
};

// What a member ends up holding, given their role and their own deviations.
export function resolveMemberPermissions(
  role: RoleGrants,
  overrides: PermissionOverrides,
): PermissionKey[] {
  return effectivePermissions({
    rolePermissions: role.permissions,
    overrides,
    locked: role.lockedPermissions,
  });
}

/*
 * Recompute `permissions` for every member of a role.
 *
 * Called after a role's grant set changes. Each member keeps their own overrides
 * — that is the whole contract of the per-member switches: an admin who denied
 * one reviewer `payments` has that decision survive the role gaining it, while
 * every other reviewer picks the new grant up.
 *
 * Takes the transaction client rather than the global one so the role write and
 * the members it moves land together; a partial apply would leave some members
 * on the old grant set with nothing to tell them apart.
 *
 * Deleted profiles are included on purpose. A revoked account's row is retained
 * (team.service.ts) and could in principle be restored, and leaving it on a stale
 * grant set would make the restore hand back access the role no longer gives.
 */
export async function syncRolePermissions(
  tx: Prisma.TransactionClient,
  roleKey: string,
): Promise<number> {
  const role = await tx.staffRole.findUnique({
    where: { key: roleKey },
    select: { permissions: true, lockedPermissions: true },
  });

  if (!role) return 0;

  const members = await tx.staffProfile.findMany({
    where: { roleKey },
    select: { id: true, permissionOverrides: true },
  });

  for (const member of members) {
    await tx.staffProfile.update({
      where: { id: member.id },
      data: {
        permissions: resolveMemberPermissions(
          role,
          parseOverrides(member.permissionOverrides),
        ),
      },
    });
  }

  return members.length;
}

/*
 * Reduce a role's own submitted grid to what gets stored on the role row.
 *
 * The same three rules as a member's set — unknown keys dropped, locked keys
 * forced on, orphan `.all` scopes dropped — because a role's array is read
 * straight into a member's effective set and inherits the invariant.
 */
export function resolveRolePermissions(
  submitted: Record<string, boolean>,
  locked: readonly string[],
): PermissionKey[] {
  return sanitizePermissionKeys(
    Object.entries(submitted)
      .filter(([, on]) => on)
      .map(([key]) => key),
    locked,
  );
}
