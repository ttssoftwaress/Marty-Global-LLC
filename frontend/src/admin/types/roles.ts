/*
 * Admin job roles — local mirror of the API shapes the roles screen reads and
 * writes. The backend is the source of truth (AGENTS.md, two-apps sync rule).
 *
 * A role is the starting point for every member holding it, not a template
 * copied once: editing what a role grants moves everyone on it, except on the
 * keys an admin has decided individually for one account. The per-member
 * switches are that override — see `types/team-member-edit.ts`.
 */

import type { TeamPermissionArea } from './team';

export type { TeamPermissionArea };

/*
 * The coarse authorization role members of a job role carry on their user row.
 * It is the only thing the request guards read, which is why it is a separate
 * choice from the permission grid rather than derived from it.
 */
export type StaffAuthRole = 'staff' | 'admin';

/*
 * One option for the access-level control, with the sentence explaining what it
 * means. The wording comes from the backend so the consequence of picking
 * `admin` — reaching every section regardless of the grid — is described in one
 * place rather than restated in the browser.
 */
export type StaffAuthRoleOption = {
  value: StaffAuthRole;
  label: string;
  description: string;
};

/*
 * A job role as the screen renders it.
 *
 * `key` is the opaque identifier profiles point at; it is derived from the name
 * at creation and never changes, so renaming a role moves `label` alone.
 *
 * `permissions` is the role's own grid, area key → granted, with every catalogue
 * key present so a denied area is visibly denied rather than silently absent.
 *
 * `grantsFullAccess` is true when `authRole` is `admin`: those members reach
 * every admin section whatever the grid says, because the guards short-circuit
 * on the authorization role. The API publishes it rather than the browser
 * inferring it from `authRole`, so the warning cannot drift from the rule.
 *
 * `canDelete` is false for a built-in role and for any role somebody still
 * holds; `deleteBlockedReason` is the sentence to print when it is.
 */
export type AdminStaffRole = {
  id: string;
  key: string;
  label: string;
  authRole: StaffAuthRole;
  isSystem: boolean;
  permissions: Record<string, boolean>;
  lockedPermissions: string[];
  memberCount: number;
  grantsFullAccess: boolean;
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

/*
 * The roles screen in one call: the roles themselves, the permission areas the
 * grid draws, and the access-level options. One request so a role is guaranteed
 * to have a row for every key it grants.
 */
export type AdminStaffRolesView = {
  roles: AdminStaffRole[];
  permissionAreas: TeamPermissionArea[];
  authRoleOptions: StaffAuthRoleOption[];
};

/*
 * What the role form edits. Narrower than the record — the key, the member
 * count, and the delete rules are the API's, not the admin's to type.
 */
export type StaffRoleDraft = {
  label: string;
  authRole: StaffAuthRole;
  permissions: Record<string, boolean>;
};

export type StaffRoleCreatePayload = StaffRoleDraft;

// A PATCH applies only what it carries, mirroring `updateStaffRoleSchema`.
export type StaffRoleWritePayload = Partial<StaffRoleDraft>;

export type StaffRoleErrors = Partial<Record<'label', string>>;
