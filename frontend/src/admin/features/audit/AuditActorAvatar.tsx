import { Cog, HelpCircle } from 'lucide-react';

import { InitialsAvatar } from '../../components/InitialsAvatar';
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
 * For a real account it is the shared `InitialsAvatar`, whose tint is hashed off
 * the actor id — so one person keeps one colour down the whole trail rather than
 * shifting with their position in it. Same rule as every other avatar in the
 * admin portal.
 */

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
    <InitialsAvatar
      seed={actor.id ?? actor.name}
      initials={actor.initials}
      className={size}
    />
  );
}
