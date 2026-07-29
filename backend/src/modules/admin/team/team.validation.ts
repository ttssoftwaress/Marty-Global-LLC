import { z } from 'zod';

/*
 * The admin team & staff wire contract. Mirrors
 * `frontend/src/admin/types/team.ts` and `team-member-edit.ts`.
 *
 * The role options and the permission areas are published by
 * `lib/permissions.ts`, not accepted from the client — the create and edit forms
 * render what the backend offers and send back keys from that same set.
 *
 * There is no invite flow: an admin creates the login itself, so a member is
 * either active or deactivated from the moment the account exists.
 */

export const teamStatusFilter = z.enum(['all', 'active', 'deactivated']);
export type TeamStatusFilter = z.infer<typeof teamStatusFilter>;

export const listTeamQuerySchema = z.object({
  status: teamStatusFilter.default('all'),
  // A role key from GET /admin/team/summary; absent means every role.
  role: z.string().trim().min(1).max(40).optional(),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListTeamQuery = z.infer<typeof listTeamQuerySchema>;

/*
 * The password an admin sets for the new staff login. The bounds match
 * `config/auth.ts` (`minPasswordLength` 8, `maxPasswordLength` 128) so a value
 * this schema accepts is one Better Auth will also accept — a mismatch would
 * surface as an opaque provider error rather than a field-level 400.
 */
const staffPassword = z.string().min(8).max(128);

/*
 * The "Add staff member" form's POST.
 *
 * The admin sets the credential directly — there is no invitation email and no
 * pending state. `permissions` is optional: omitted, the role's defaults from
 * `lib/permissions.ts` apply, which is what the form sends when the admin has
 * not touched the grid.
 */
export const createTeamMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  password: staffPassword,
  role: z.string().trim().min(1).max(40),
  isActive: z.boolean().default(true),
  permissions: z.record(z.string(), z.boolean()).optional(),
});
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;

/*
 * The edit form's PATCH. Every field on the form is writable and a PATCH applies
 * only what it carries.
 *
 * `password` is optional and write-only — sending it resets the member's login
 * credential; omitting it leaves the existing one untouched. It is never read
 * back on any response.
 *
 * `permissions` is a map of area key → granted, exactly as the switch grid holds
 * it. The service resolves it against the catalogue: unknown keys are dropped
 * and the role's locked areas are forced on, so what the client sends is a
 * request rather than the final word.
 */
export const updateTeamMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().max(200).optional(),
    password: staffPassword.optional(),
    isActive: z.boolean().optional(),
    role: z.string().trim().min(1).max(40).optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
