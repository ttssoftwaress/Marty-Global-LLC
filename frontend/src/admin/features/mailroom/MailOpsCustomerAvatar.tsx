import { InitialsAvatar } from '../../components/InitialsAvatar';

/*
 * The customer avatar on the mail-ops screens — the shared initials disc with
 * this screen's resting size.
 *
 * All three links show photographs here. We render initials at every width
 * (Design.md, logged as a deviation): the photos in the design are stock
 * placeholders, there is no avatar-image field behind this screen, and initials
 * degrade correctly for every customer rather than only those who uploaded a
 * picture. This mirrors the customers list' `CustomerAvatar` and the support
 * inbox' `SupportAgentAvatar` decisions.
 *
 * `InitialsAvatar` hashes the tint off the customer id, so one customer keeps
 * the same colour in the picker, the selected row, and the recent feed instead
 * of shifting with position.
 *
 * `initials` comes from the API rather than being sliced off the name here, so
 * names that a naive split would mangle still render correctly.
 */

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
    <InitialsAvatar
      seed={id}
      initials={initials}
      className={className ?? 'size-8'}
    />
  );
}
