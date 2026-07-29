/*
 * Password requirement checks and strength scoring for the Password & security
 * frame. The design shows a 4-segment strength bar and a three-line requirement
 * checklist (12 characters, one number, one symbol); this derives both from the
 * actual typed value — nothing is hardcoded, so the meter and checklist reflect
 * real input the moment the customer types.
 *
 * This is a UX affordance only. The backend (Better Auth) remains the real
 * policy boundary; these checks never gate the server-side rule.
 */

export type PasswordRequirement = {
  id: 'length' | 'number' | 'symbol';
  label: string;
  met: (password: string) => boolean;
};

// The three requirements shown in the design's checklist, in order.
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'length',
    label: 'At least 12 characters',
    met: (password) => password.length >= 12,
  },
  {
    id: 'number',
    label: 'One number',
    met: (password) => /\d/.test(password),
  },
  {
    id: 'symbol',
    label: 'One symbol',
    met: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

// The strength bar has four segments. Score = how many requirements are met,
// plus one bonus segment for length well beyond the minimum — so a password can
// reach "strong" (all four) only when it clears every rule and has real length.
export function passwordStrength(password: string): number {
  if (!password) return 0;
  const metCount = PASSWORD_REQUIREMENTS.filter((rule) =>
    rule.met(password),
  ).length;
  const lengthBonus = password.length >= 16 ? 1 : 0;
  return Math.min(4, metCount + lengthBonus);
}
