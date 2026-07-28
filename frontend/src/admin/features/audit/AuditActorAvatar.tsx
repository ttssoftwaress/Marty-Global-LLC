import { Cog, HelpCircle } from 'lucide-react';

import type { AdminAuditActor } from '../../types/audit';

/*
 * The actor disc on an audit row.
 *
 * Its own component rather than the team screen's avatar, because this screen
 * has two actors the team screen cannot have, and they must not look alike:
 *
 *   - the SYSTEM — a job processor crediting a payment or sweeping reminders.
 *     Takes a cog on a flat grey disc, visibly not a person.
 *   - an UNIDENTIFIED CALLER — a failed sign-in that matched no account. It
 *     also has no actor id, but "the system did this" would be a lie on exactly
 *     the row an admin is reading most closely, so it takes a question mark on
 *     an error tint instead.
 *
 * Both are told apart by the actor's `kind`, not by a null id or a display
 * name: the service decides which of the two an actorless row is, and this only
 * draws the answer.
 *
 * For a real account the tint is picked with a hash of the actor id, so one
 * person keeps one colour down the whole trail rather than shifting with their
 * position in it. Same rule as every other avatar in the admin portal.
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

type AuditActorAvatarProps = {
  actor: AdminAuditActor;
  className?: string;
};

export function AuditActorAvatar({ actor, className }: AuditActorAvatarProps) {
  const size = className ?? 'size-8';

  if (actor.kind === 'system') {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 ${size}`}
      >
        <Cog className="size-4" strokeWidth={1.75} />
      </span>
    );
  }

  if (actor.kind === 'anonymous') {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full bg-error/10 text-error ${size}`}
      >
        <HelpCircle className="size-4" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-small font-semibold ${tintFor(actor.id ?? actor.name)} ${size}`}
    >
      {actor.initials}
    </span>
  );
}
