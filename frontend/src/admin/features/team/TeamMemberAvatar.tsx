/*
 * The team member avatar — an initials disc.
 *
 * The mobile link fills the disc with a saturated hue and white initials; the
 * tablet link uses a flat grey disc, and the desktop link shows a photograph
 * placeholder. Initials on a soft tint render at every width (Design.md, logged
 * as a deviation): there is no avatar-image field behind this screen, the tinted
 * disc carries more of the mobile link's character than a flat grey one, and the
 * softer background keeps the initials at a readable contrast where the mobile
 * link's saturated fills do not.
 *
 * The tint is picked with a hash of the member id, so a given person keeps one
 * colour across pages, renders, and breakpoints instead of shifting with their
 * position in the list. Same rule as the customers list' avatar.
 *
 * `initials` comes from the API rather than being sliced off the name here, so
 * names that a naive split would mangle still render correctly.
 */

const TINTS = [
  'bg-[#e0e7ff] text-[#4338ca]',
  'bg-[#ffedd5] text-[#c2410c]',
  'bg-[#d1fae5] text-[#065f46]',
  'bg-[#f3e8ff] text-[#6b21a8]',
  'bg-[#fce7f3] text-[#9d174d]',
  'bg-[#e0f2fe] text-[#0369a1]',
  'bg-[#fef3c7] text-[#92400e]',
];

function tintFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

type TeamMemberAvatarProps = {
  id: string;
  initials: string;
  className?: string;
};

export function TeamMemberAvatar({
  id,
  initials,
  className,
}: TeamMemberAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-small font-semibold ${tintFor(id)} ${
        className ?? 'size-8'
      }`}
    >
      {initials}
    </span>
  );
}
