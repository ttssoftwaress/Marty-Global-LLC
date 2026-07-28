/*
 * The staff avatar — an initials disc.
 *
 * Every link shows photographs here. We render initials at every width
 * (Design.md, logged as a deviation): the photos in the design are stock
 * placeholders, there is no avatar-image field behind this screen, and initials
 * degrade correctly for every person rather than only those who uploaded a
 * picture. This mirrors the customers list' `CustomerAvatar` decision.
 *
 * The tint is picked with a hash of the person's id, so one person keeps the
 * same colour across the list, the thread header, and every message bubble
 * instead of shifting with position.
 *
 * `initials` comes from the API rather than being sliced off the name here, so
 * names that a naive split would mangle still render correctly.
 */

const TINTS = [
  'bg-[#dbeafe] text-[#1e40af]',
  'bg-[#d1fae5] text-[#065f46]',
  'bg-[#fee2e2] text-[#991b1b]',
  'bg-[#fef3c7] text-[#92400e]',
  'bg-[#f3e8ff] text-[#6b21a8]',
  'bg-[#e0f2fe] text-[#0369a1]',
];

function tintFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

type SupportAgentAvatarProps = {
  id: string;
  initials: string;
  className?: string;
};

export function SupportAgentAvatar({
  id,
  initials,
  className,
}: SupportAgentAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tintFor(id)} ${
        className ?? 'size-4 text-[0.5rem]'
      }`}
    >
      {initials}
    </span>
  );
}
