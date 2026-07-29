/*
 * The initials-disc tint, shared by every avatar in the admin portal.
 *
 * Five screens draw an initials disc — customers, customer detail, team, the
 * support inbox, mail ops, and the audit trail — and each had its own copy of
 * this palette and hash. The copies had already drifted into two different
 * palettes, so the same person could read as blue on one screen and indigo on
 * the next, which is exactly what a hash-picked colour exists to prevent.
 *
 * The tint is picked from a hash of a stable seed (the record id), not from the
 * row's position, so one person keeps one colour across pages, renders, and
 * breakpoints. Colours are identity only and carry no meaning — a red disc says
 * nothing about the record's state.
 *
 * The class strings are written out in full rather than composed, because
 * Tailwind scans source text for complete class names.
 */

const TINTS = [
  'bg-avatar-blue-bg text-avatar-blue-text',
  'bg-avatar-green-bg text-avatar-green-text',
  'bg-avatar-red-bg text-avatar-red-text',
  'bg-avatar-amber-bg text-avatar-amber-text',
  'bg-avatar-purple-bg text-avatar-purple-text',
  'bg-avatar-sky-bg text-avatar-sky-text',
  'bg-avatar-indigo-bg text-avatar-indigo-text',
  'bg-avatar-orange-bg text-avatar-orange-text',
  'bg-avatar-pink-bg text-avatar-pink-text',
];

export function avatarTint(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}
