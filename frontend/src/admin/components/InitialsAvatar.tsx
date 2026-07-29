import { avatarTint } from '../lib/avatar-tint';

/*
 * The initials disc every admin avatar is built from.
 *
 * Six screens draw one — customers, customer detail, team, the support inbox,
 * mail ops, and the audit trail — and each had the same span with the same
 * classes and the same `avatarTint` call, differing only in its resting size.
 * The tint was hoisted to `lib/avatar-tint` first; this is the markup that was
 * still copied around it.
 *
 * The disc is decorative: the name it abbreviates is always printed beside it,
 * so announcing "JD" as well would read the same person twice — hence
 * `aria-hidden`, at every call site.
 *
 * `className` carries the size and, where a screen needs one, an overriding type
 * scale. `text-small` is the resting size and sits in the component layer
 * (styles/index.css), so a caller's `text-[0.625rem]` utility wins over it
 * without a class-merging helper — which the stack does not have and is not
 * getting (Design.md, no `cn()`).
 */

type InitialsAvatarProps = {
  // A stable identity — the record id, never the row's position. One person
  // keeps one colour across pages, renders, and breakpoints.
  seed: string;
  initials: string;
  className?: string;
};

export function InitialsAvatar({
  seed,
  initials,
  className = 'size-8',
}: InitialsAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-small font-semibold ${avatarTint(seed)} ${className}`}
    >
      {initials}
    </span>
  );
}
