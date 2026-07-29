/*
 * The customer avatar — an initials disc.
 *
 * All three links show photographs here. We render initials at every width
 * (Design.md, logged as a deviation): the photos in the design are stock
 * placeholders, there is no avatar-image field behind this screen, and initials
 * degrade correctly for every customer rather than only those who uploaded a
 * picture. This mirrors the customers list' `CustomerAvatar` and the support
 * inbox' `SupportAgentAvatar` decisions.
 *
 * The tint is picked with a hash of the customer id, so one customer keeps the
 * same colour in the picker, the selected row, and the recent feed instead of
 * shifting with position.
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

type MailOpsCustomerAvatarProps = {
  id: string;
  initials: string;
  className?: string;
};

export function MailOpsCustomerAvatar({
  id,
  initials,
  className,
}: MailOpsCustomerAvatarProps) {
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
