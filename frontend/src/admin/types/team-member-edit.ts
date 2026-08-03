/*
 * Admin "Edit team member" — local mirror of the API shapes this screen reads
 * and writes. The backend is the source of truth (AGENTS.md, two-apps sync
 * rule); these types exist so the editor compiles and composes before the
 * endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the member's name, email,
 * status, role, the role options the dropdown offers, and the permission areas
 * the grid lists all arrive from the API.
 */

import type { TeamPermissionArea, TeamRoleOption } from './team';

// Defined with the list types (the summary carries its own copy for the
// add-staff form) and re-exported so this module stays the one import for
// everything the member forms render.
export type { TeamPermissionArea };

/*
 * The member being edited, plus the chrome the form needs to render itself: the
 * role options for the dropdown and the permission areas for the grid. One call,
 * so the role the member holds is guaranteed to exist in the options list and
 * every granted key is guaranteed to have a row.
 *
 * `permissions` is a map of area key → granted. An area missing from the map
 * reads as not granted, so a backend that only sends the granted keys and one
 * that sends every key both render correctly.
 *
 * `isActive` is the member-status switch: true is the design's "Active — account
 * is fully active and enabled". `statusDescription` is the sentence printed
 * under it, so the wording for each state stays with the backend rather than
 * being assembled here.
 */
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
   * switches show and what an edit writes back. It is their role's grants with
   * their own overrides applied on top.
   */
  permissions: Record<string, boolean>;
  /*
   * What the role alone gives. The pair is what makes an override legible: a
   * switch that disagrees with this is a decision somebody took about this one
   * account, and the screen marks it and offers to put it back. Without it a
   * denied area and an area the role never granted look identical.
   */
  rolePermissions: Record<string, boolean>;
  // The keys that currently disagree. Derived from the two maps above, but sent
  // rather than diffed here so "is this overridden" has one definition.
  overriddenPermissions: string[];
  /*
   * True when the role carries the `admin` authorization role: the backend's
   * guards let an admin past every area check, so this member reaches every
   * section whatever the grid below says. The screen warns rather than letting
   * an admin discover it by accident.
   */
  roleGrantsFullAccess: boolean;
  roles: TeamRoleOption[];
  permissionAreas: TeamPermissionArea[];
};

/*
 * What the form edits. It is deliberately narrower than the detail record —
 * the role options and the area list are chrome the API owns, not values the
 * admin can change here.
 *
 * `password` is the optional credential reset: left blank the member keeps the
 * password they have, and it is never seeded from the API — a password is
 * write-only and no response carries one back.
 */
export type TeamMemberEditDraft = {
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  role: string;
  permissions: Record<string, boolean>;
};

/*
 * The PATCH body. Every field is optional, mirroring `updateTeamMemberSchema` —
 * a PATCH applies only what it carries, so omitting a key is what leaves that
 * value alone. Two callers rely on it: the edit form sends the whole draft,
 * while the list row's status action sends `isActive` on its own (the rows do
 * not carry a role or a permission grid to resend).
 *
 * A blank password is dropped rather than sent: it is write-only, and an empty
 * string would fail the backend's length check instead of meaning "unchanged".
 */
export type TeamMemberWritePayload = Partial<TeamMemberEditDraft> & {
  /*
   * "Follow the role again" — clears every per-member override in one write.
   *
   * A separate flag rather than an empty `permissions` map, because those mean
   * opposite things: an empty map is a grid with everything switched off, which
   * is a legal thing for an admin to want.
   */
  resetPermissions?: boolean;
};

/*
 * The "Add staff member" form. The same fields as the editor, except the
 * password is required — an admin is creating the login here, so there is no
 * existing credential to fall back on.
 */
export type TeamMemberCreateDraft = TeamMemberEditDraft;

export type TeamMemberCreatePayload = Omit<
  TeamMemberEditDraft,
  'password' | 'permissions'
> & {
  password: string;
  // Optional, as in `createTeamMemberSchema`: omitted, the backend applies the
  // role's defaults, which is what the form sends when the admin never touched
  // the grid.
  permissions?: Record<string, boolean>;
};

/*
 * Field-level validation messages, keyed by draft field. Only the three text
 * inputs can be invalid — the switches and the select are always in a legal
 * state because their values come from the API.
 */
export type TeamMemberEditErrors = Partial<
  Record<'name' | 'email' | 'password', string>
>;
