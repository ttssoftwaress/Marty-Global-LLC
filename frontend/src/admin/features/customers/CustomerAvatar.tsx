import { InitialsAvatar } from '../../components/InitialsAvatar';

/*
 * The customer avatar — the shared initials disc with this screen's resting
 * size.
 *
 * The desktop and tablet links show photographs here and the mobile link shows
 * tinted initials. We render initials at every width (Design.md, logged as a
 * deviation): the photos in the design are stock placeholders, there is no
 * avatar-image field behind this screen, and initials degrade correctly for
 * every customer rather than only those who have uploaded a picture.
 *
 * The mobile link cycles a set of soft tints down the list, which `InitialsAvatar`
 * reproduces by hashing the customer id — so a given customer keeps one colour
 * across pages, renders, and breakpoints instead of shifting with its position
 * in the list.
 *
 * `initials` comes from the API rather than being sliced off the name here, so
 * names that a naive split would mangle still render correctly.
 */

type CustomerAvatarProps = {
  id: string;
  initials: string;
  className?: string;
};

export function CustomerAvatar({ id, initials, className }: CustomerAvatarProps) {
  return (
    <InitialsAvatar
      seed={id}
      initials={initials}
      className={className ?? 'size-8'}
    />
  );
}
