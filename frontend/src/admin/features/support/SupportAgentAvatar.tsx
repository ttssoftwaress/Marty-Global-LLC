import { InitialsAvatar } from '../../components/InitialsAvatar';

/*
 * The staff avatar — the shared initials disc, at the much smaller resting size
 * the inbox uses beside a conversation title.
 *
 * Every link shows photographs here. We render initials at every width
 * (Design.md, logged as a deviation): the photos in the design are stock
 * placeholders, there is no avatar-image field behind this screen, and initials
 * degrade correctly for every person rather than only those who uploaded a
 * picture. This mirrors the customers list' `CustomerAvatar` decision.
 *
 * `InitialsAvatar` hashes the tint off the person's id, so one person keeps the
 * same colour across the list, the thread header, and every message bubble
 * instead of shifting with position.
 *
 * `initials` comes from the API rather than being sliced off the name here, so
 * names that a naive split would mangle still render correctly.
 */

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
    <InitialsAvatar
      seed={id}
      initials={initials}
      className={className ?? 'size-4 text-[0.5rem]'}
    />
  );
}
