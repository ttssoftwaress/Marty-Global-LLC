import type {
  AdminTeamMemberDetail,
  TeamPermissionArea,
  TeamMemberCreateDraft,
  TeamMemberCreatePayload,
  TeamMemberEditDraft,
  TeamMemberEditErrors,
  TeamMemberWritePayload,
} from '../types/team-member-edit';

/*
 * Draft plumbing for the "Add staff member" and "Edit team member" forms —
 * seeding them, validating them, and turning them back into the write body.
 *
 * Kept out of the pages so the screens stay composition and the rules stay
 * testable, the same split the service-catalog detail screen uses.
 */

// Matches `minPasswordLength` in the backend's Better Auth config, so a value
// this accepts is one the API will also accept.
export const MIN_PASSWORD_LENGTH = 8;

/*
 * Seed the edit form from the loaded record.
 *
 * The permission map is rebuilt over the area list the API sent rather than
 * copied straight across, so every row the grid draws has a boolean behind it —
 * an area the backend omitted reads as not granted instead of `undefined`,
 * which would make the switch uncontrolled.
 *
 * Both switches on a row are seeded: the area key ("Specific data") and, where
 * the area carries one, its `scopeKey` ("All data"). Seeding only the area would
 * drop every scope grant on the next save — the payload is the whole map, so a
 * key the draft never held reads to the backend as one the admin turned off.
 *
 * The password starts blank and is never seeded: it is write-only, so no
 * response carries one back, and a blank field means "leave it alone".
 */
export function draftFromMember(
  member: AdminTeamMemberDetail,
): TeamMemberEditDraft {
  const permissions: Record<string, boolean> = {};
  for (const area of member.permissionAreas) {
    permissions[area.key] = member.permissions[area.key] === true;

    if (area.scopeKey) {
      permissions[area.scopeKey] = member.permissions[area.scopeKey] === true;
    }
  }

  return {
    name: member.name,
    email: member.email,
    password: '',
    isActive: member.isActive,
    role: member.role,
    permissions,
  };
}

/*
 * Seed a permission grid from what a role grants.
 *
 * Rebuilt over the area list rather than copied across, for the same reason
 * `draftFromMember` does it: every row the grid draws needs a boolean behind it,
 * or the switch goes uncontrolled. Both keys on a row are seeded — the area and,
 * where it has one, its scope companion — because the payload is the whole map,
 * so a key the draft never held reads to the backend as one the admin turned off.
 */
export function permissionsFromRole(
  areas: TeamPermissionArea[],
  roleGrants: Record<string, boolean>,
): Record<string, boolean> {
  const permissions: Record<string, boolean> = {};

  for (const area of areas) {
    permissions[area.key] = roleGrants[area.key] === true;

    if (area.scopeKey) {
      permissions[area.scopeKey] = roleGrants[area.scopeKey] === true;
    }
  }

  return permissions;
}

/*
 * An empty "Add staff member" form. The role defaults to the first option the
 * API offers rather than a hardcoded key, and the grid is seeded from what that
 * role grants — so the switches show what the account will actually get instead
 * of opening blank and reading as "no access".
 */
export function emptyCreateDraft(
  defaultRole: string,
  areas: TeamPermissionArea[] = [],
  roleGrants: Record<string, boolean> = {},
): TeamMemberCreateDraft {
  return {
    name: '',
    email: '',
    password: '',
    isActive: true,
    role: defaultRole,
    permissions: permissionsFromRole(areas, roleGrants),
  };
}

// A pragmatic shape check, not an RFC 5322 parser — the backend is the real
// validator (AGENTS.md); this only stops an obvious typo before a round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * Validate a draft. `requirePassword` is what separates the two forms: creating
 * a login has to set one, editing an existing member may leave the field blank
 * to keep the current credential.
 */
export function validateMemberDraft(
  draft: TeamMemberEditDraft,
  { requirePassword = false }: { requirePassword?: boolean } = {},
): TeamMemberEditErrors {
  const errors: TeamMemberEditErrors = {};

  if (!draft.name.trim()) errors.name = 'Enter the member’s full name.';

  const email = draft.email.trim();
  if (!email) {
    errors.email = 'Enter an email address.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (requirePassword && !draft.password) {
    errors.password = 'Set a password for this account.';
  } else if (draft.password && draft.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}

/*
 * The PATCH body. A blank password is dropped rather than sent — the backend
 * treats an absent key as "leave the credential alone", and sending an empty
 * string would fail its length check instead.
 *
 * The password is deliberately not trimmed: leading and trailing spaces are
 * legal characters in one, and stripping them would sign the member out of the
 * credential they were told they had.
 */
export function payloadFromDraft(
  draft: TeamMemberEditDraft,
): TeamMemberWritePayload {
  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    isActive: draft.isActive,
    role: draft.role,
    permissions: draft.permissions,
    ...(draft.password ? { password: draft.password } : {}),
  };
}

/*
 * The POST body. Unlike the PATCH the password is always carried.
 *
 * The permission map always goes too, because the form seeds it from the role
 * and the backend diffs it back against that same role — a grid the admin never
 * touched produces no overrides, and one they adjusted produces exactly the keys
 * they moved. Omitting it to mean "use the role's defaults" was the old contract
 * and is now indistinguishable from sending them.
 */
export function payloadFromCreateDraft(
  draft: TeamMemberCreateDraft,
): TeamMemberCreatePayload {
  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    password: draft.password,
    isActive: draft.isActive,
    role: draft.role,
    permissions: draft.permissions,
  };
}

/*
 * Whether the draft differs from what loaded. Compared as payloads so
 * whitespace-only edits (a trailing space in a name) don't arm Save for a write
 * that would change nothing. A typed password is always a change, since there is
 * nothing loaded to compare it against.
 */
export function isDraftDirty(
  draft: TeamMemberEditDraft,
  member: AdminTeamMemberDetail,
): boolean {
  return (
    JSON.stringify(payloadFromDraft(draft)) !==
    JSON.stringify(payloadFromDraft(draftFromMember(member)))
  );
}
