import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../guards/index.js';
import type { AuthContext } from '../../guards/auth-context.js';
import { AppError } from '../../lib/app-error.js';
import {
  scopeKeyFor,
  type PermissionKey,
  type ScopedArea,
} from '../../lib/permissions.js';
import { prisma } from '../../lib/prisma.js';
import { Role } from '../../lib/roles.js';
import { StaffStatus } from '@prisma/client';

/*
 * Per-area authorization for the admin portal, layered on top of the role guards
 * the admin router already applies (requireAuth → requireStaff).
 *
 * The frontend's team-edit screen writes a permission grid per member; this is
 * the guard that makes those switches mean something. Without it the grid would
 * be decoration — every staff member could reach every admin endpoint regardless
 * of what the grid said, which is exactly the gap AGENTS.md warns about when it
 * calls the backend guards "the real boundary".
 *
 * Three rules:
 *   - Only a staff or admin role gets past at all. The admin router already
 *     applies requireStaff ahead of this, so that check is redundant in
 *     practice — but a guard that grants access must be correct on its own, not
 *     because of what happens to be mounted in front of it.
 *   - An admin passes every area. Narrowing an admin's own access is how an org
 *     locks itself out, and `super-admin` already carries `team` as a locked
 *     area (lib/permissions.ts).
 *   - A staff member with no StaffProfile passes nothing. A staff role without a
 *     profile is an incompletely provisioned account, and the safe reading of an
 *     absent grant list is "denied", never "unrestricted".
 */

/*
 * Does this actor hold an area? The same three rules as the guard below, as a
 * predicate.
 *
 * It exists because not every permission maps to a whole route. Assigning an
 * order is one field on the order PATCH that also carries the status change, so
 * the check has to happen where that field is read — in the service — while
 * still being the same rule the router applies. One definition, two call sites.
 */
export async function hasPermission(
  actor: AuthContext,
  area: PermissionKey,
): Promise<boolean> {
  if (actor.role === Role.ADMIN) return true;
  if (actor.role !== Role.STAFF) return false;

  const profile = await prisma.staffProfile.findFirst({
    where: { userId: actor.userId, deletedAt: null },
    select: { permissions: true, status: true },
  });

  // A deactivated member keeps their session until it expires; the profile
  // status is what actually revokes their access.
  return (
    profile?.status === StaffStatus.ACTIVE && profile.permissions.includes(area)
  );
}

export function requirePermission(area: PermissionKey) {
  return async function permissionGuard(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    try {
      if (!(await hasPermission(getAuth(req), area))) {
        throw AppError.unauthorized();
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/*
 * Does this actor read the whole org in this section, or only their own records?
 *
 * This is the one predicate every scoped service asks, and the single definition
 * of what the team screen's "All data" column means. `requirePermission` decides
 * whether a member reaches a section at all; this decides what is in it once
 * they do.
 *
 * `hasPermission` passes an admin unconditionally, so an admin is unscoped
 * everywhere without a second rule — the same shortcut the guard takes.
 *
 * Orders carry one extra clause: `orders.assign` implies seeing every order.
 * Distributing work across the team is impossible when the unassigned filings
 * are invisible, so the grant that hands out work also widens the queue. It is
 * folded in here rather than at the call site so no future caller can forget it.
 */
export async function canSeeAll(
  actor: AuthContext,
  area: ScopedArea,
): Promise<boolean> {
  if (await hasPermission(actor, scopeKeyFor(area))) return true;

  return area === 'orders' && (await hasPermission(actor, 'orders.assign'));
}
