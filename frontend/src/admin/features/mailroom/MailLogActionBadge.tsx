import { mailLogActionStyle } from '../../lib/mail-requests';
import type { MailLogAction } from '../../types/mailroom';

/*
 * The "Final action" pill — how a closed mail item was disposed of.
 *
 * Shares the queue badges' shape (icon + label in a pill) but not their
 * component: the tint lookup is a different map, and the log's pill keeps a
 * 12px label at every width where the queue's steps 11 → 12px. Parameterising
 * one component across both would cost more than the twenty lines here.
 *
 * The label is server-resolved (`actionLabel`), so the wording stays owned by
 * the API and this only dresses it.
 *
 * The design draws a 6px radius on desktop and mobile and a full pill on
 * tablet; the pill is used at every width (logged as a deviation) since that is
 * the shape every other badge in the admin area wears.
 */

type MailLogActionBadgeProps = {
  action: MailLogAction;
  label: string;
};

export function MailLogActionBadge({ action, label }: MailLogActionBadgeProps) {
  const { icon: Icon, className } = mailLogActionStyle(action);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold lg:text-small ${className}`}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}
