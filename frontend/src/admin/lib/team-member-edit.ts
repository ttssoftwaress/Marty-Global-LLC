import type {
  AdminTeamMemberDetail,
  TeamMemberEditDraft,
  TeamMemberEditErrors,
  TeamMemberWritePayload,
} from '../types/team-member-edit';

/*
 * Draft plumbing for the "Edit team member" form — seeding it from what loaded,
 * validating it, and turning it back into the PATCH body.
 *
 * Kept out of the page so the screen stays composition and the rules stay
 * testable, the same split the service-catalog detail screen uses.
 */

/*
 * Seed the form from the loaded record.
 *
 * The permission map is rebuilt over the area list the API sent rather than
 * copied straight across, so every row the grid draws has a boolean behind it —
 * an area the backend omitted reads as not granted instead of `undefined`,
 * which would make the switch uncontrolled.
 */
export function draftFromMember(
  member: AdminTeamMemberDetail,
): TeamMemberEditDraft {
  const permissions: Record<string, boolean> = {};
  for (const area of member.permissionAreas) {
    permissions[area.key] = member.permissions[area.key] === true;
  }

  return {
    name: member.name,
    email: member.email,
    isActive: member.isActive,
    role: member.role,
    permissions,
  };
}

// A pragmatic shape check, not an RFC 5322 parser — the backend is the real
// validator (AGENTS.md); this only stops an obvious typo before a round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMemberDraft(
  draft: TeamMemberEditDraft,
): TeamMemberEditErrors {
  const errors: TeamMemberEditErrors = {};

  if (!draft.name.trim()) errors.name = 'Enter the member’s full name.';

  const email = draft.email.trim();
  if (!email) {
    errors.email = 'Enter an email address.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
}

export function payloadFromDraft(
  draft: TeamMemberEditDraft,
): TeamMemberWritePayload {
  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    isActive: draft.isActive,
    role: draft.role,
    permissions: draft.permissions,
  };
}

/*
 * Whether the draft differs from what loaded. Compared as payloads so
 * whitespace-only edits (a trailing space in a name) don't arm Save for a write
 * that would change nothing.
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
