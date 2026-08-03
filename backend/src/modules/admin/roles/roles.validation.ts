import { z } from 'zod';

import { Role } from '../../../lib/roles.js';

/*
 * The admin job-role wire contract. Mirrors `frontend/src/admin/types/roles.ts`.
 *
 * The permission areas the grid renders are published by `lib/permissions.ts`,
 * never accepted from the client — the form renders what the backend offers and
 * sends keys back from that same set. `key` is not on either schema: it is
 * derived from the label at creation and immutable afterwards, because
 * StaffProfile rows and audit entries point at it.
 */

// `admin` members bypass every per-area guard, so the two are not interchangeable
// and the form makes the choice explicitly rather than defaulting it.
export const roleAuthRole = z.enum([Role.STAFF, Role.ADMIN]);

const roleLabel = z.string().trim().min(2).max(60);

/*
 * `permissions` is the role's own grid, area key → granted, exactly as the
 * switches hold it. The service resolves it against the catalogue: unknown keys
 * are dropped, a scope key without its area is dropped, and the role's locked
 * areas are forced on — so what the client sends is a request, never the final
 * word (AGENTS.md: business logic lives in services).
 */
export const createStaffRoleSchema = z.object({
  label: roleLabel,
  authRole: roleAuthRole,
  permissions: z.record(z.string(), z.boolean()).default({}),
});
export type CreateStaffRoleInput = z.infer<typeof createStaffRoleSchema>;

/*
 * A PATCH applies only what it carries. `authRole` is rejected on a system role
 * by the service rather than by this schema — the shape is legal, the transition
 * is not, which is a 422 and not a 400.
 */
export const updateStaffRoleSchema = z
  .object({
    label: roleLabel.optional(),
    authRole: roleAuthRole.optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;
