/*
 * The customer avatar — an initials disc.
 *
 * The desktop and tablet links show photographs here and the mobile link shows
 * tinted initials. We render initials at every width (Design.md, logged as a
 * deviation): the photos in the design are stock placeholders, there is no
 * avatar-image field behind this screen, and initials degrade correctly for
 * every customer rather than only those who have uploaded a picture.
 *
 * The mobile link cycles a set of soft tints down the list, which is reproduced
 * here by picking from that same palette with a hash of the customer id — so a
 * given customer keeps one colour across pages, renders, and breakpoints instead
 * of shifting with its position in the list.
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

type CustomerAvatarProps = {
  id: string;
  initials: string;
  className?: string;
};

export function CustomerAvatar({ id, initials, className }: CustomerAvatarProps) {
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
