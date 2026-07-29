import { InitialsAvatar } from '../../components/InitialsAvatar';

/*
 * The team member avatar — the shared initials disc with this screen's resting
 * size.
 *
 * The mobile link fills the disc with a saturated hue and white initials; the
 * tablet link uses a flat grey disc, and the desktop link shows a photograph
 * placeholder. Initials on a soft tint render at every width (Design.md, logged
 * as a deviation): there is no avatar-image field behind this screen, the tinted
 * disc carries more of the mobile link's character than a flat grey one, and the
 * softer background keeps the initials at a readable contrast where the mobile
 * link's saturated fills do not.
 *
 * `InitialsAvatar` hashes the tint off the member id, so a given person keeps
 * one colour across pages, renders, and breakpoints instead of shifting with
 * their position in the list. Same rule as the customers list' avatar.
 *
 * `initials` comes from the API rather than being sliced off the name here, so
 * names that a naive split would mangle still render correctly.
 */

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
    <InitialsAvatar
      seed={id}
      initials={initials}
      className={className ?? 'size-8'}
    />
  );
}
