/*
 * Admin team & staff — local mirror of the API shapes this screen renders. The
 * backend is the source of truth (AGENTS.md, two-apps sync rule); these types
 * exist so the UI compiles and composes before the endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the three KPI figures, the
 * role options, the status tabs, and the member rows all arrive from the API.
 */

/*
 * A member's account state. Keeping it a closed union (rather than free strings)
 * is what lets the row pick a chip and the page decide which secondary action to
 * offer without validating a string first.
 *
 * `invited` is a member who has been sent an invite but has not accepted it —
 * they have no join date, and their secondary action resends the invite rather
 * than deactivating an account that does not exist yet.
 */
export type TeamMemberStatus = 'active' | 'invited' | 'deactivated';

/*
 * The filter tabs above the list. `all` is the unfiltered view the screen opens
 * on; the rest narrow to one status. It is a separate union from
 * `TeamMemberStatus` because `all` is a filter, not a state a member can be in.
 */
export type TeamStatusFilter = 'all' | TeamMemberStatus;

/*
 * A status tab. The label comes from the backend so the strip stays in step with
 * whatever wording the business uses — the UI never invents one. `count` is
 * optional: the links print bare labels here, so a backend that supplies counts
 * gets them rendered and one that does not still reads correctly.
 */
export type TeamStatusTab = {
  value: TeamStatusFilter;
  label: string;
  count?: number;
};

/*
 * A role option for the dropdown. Values are opaque to the UI — they go back to
 * the API verbatim as a query param.
 */
export type TeamRoleOption = {
  value: string;
  label: string;
};

export const ALL_ROLES = 'all';

/*
 * A team member row.
 *
 * `initials` comes from the backend rather than being sliced off the name here,
 * so a two-word Latin name and a single-glyph script both render correctly — the
 * same rule the customers list and orders queue follow.
 *
 * `roleLabel` is the display wording for the member's role ("Super Admin",
 * "Reviewer / Compliance"); `role` is the opaque value that matches a
 * `TeamRoleOption` so the dropdown and the row agree.
 *
 * `joinedAt` is ISO-8601 UTC, converted to the viewer's zone only at render
 * (AGENTS.md, Dates). It is null for an invited member who has not accepted yet
 * — the design prints an em dash there.
 */
export type AdminTeamMemberRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  roleLabel: string;
  status: TeamMemberStatus;
  statusLabel: string;
  joinedAt: string | null;
};

/*
 * One page of the list plus the figures the footer prints. Cursor pagination is
 * the API convention (AGENTS.md), so `nextCursor` drives mobile's "Load more";
 * `page`/`totalPages` drive the numbered pager the wider links show.
 */
export type AdminTeamPage = {
  members: AdminTeamMemberRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number; // total matching the current filters
};

/*
 * The screen's KPI figures and filter chrome — one call, so the three cards, the
 * tabs, and the role options agree with each other and with the list.
 */
export type AdminTeamSummary = {
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  tabs: TeamStatusTab[];
  roles: TeamRoleOption[];
};
