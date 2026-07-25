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

import type { TeamRoleOption } from './team';

/*
 * One area of the admin portal a member can be granted or denied.
 *
 * `key` is opaque to the UI — it is what goes back to the API in the write
 * payload; `label` is the wording the row prints. Keeping the area set on the
 * wire (rather than as a frontend constant) means adding an admin section is a
 * backend change, not a frontend deploy — the same rule the role options and
 * status tabs on the list screen follow.
 *
 * `locked` marks an area the current admin may not change on this member (a
 * super-admin's own access, for instance). The row still renders so the member's
 * real access is visible; the switch is disabled rather than hidden.
 */
export type TeamPermissionArea = {
  key: string;
  label: string;
  locked?: boolean;
};

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
  isActive: boolean;
  statusDescription: string;
  permissions: Record<string, boolean>;
  roles: TeamRoleOption[];
  permissionAreas: TeamPermissionArea[];
};

/*
 * What the form edits. It is deliberately narrower than the detail record —
 * the role options and the area list are chrome the API owns, not values the
 * admin can change here.
 */
export type TeamMemberEditDraft = {
  name: string;
  email: string;
  isActive: boolean;
  role: string;
  permissions: Record<string, boolean>;
};

/*
 * The PATCH body. Same shape as the draft: every field on the form is writable,
 * and a PATCH applies only what it carries.
 */
export type TeamMemberWritePayload = TeamMemberEditDraft;

/*
 * Field-level validation messages, keyed by draft field. Only the two text
 * inputs can be invalid — the switches and the select are always in a legal
 * state because their values come from the API.
 */
export type TeamMemberEditErrors = Partial<
  Record<'name' | 'email', string>
>;
