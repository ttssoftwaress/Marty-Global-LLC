import { formatOrderDate } from '../../lib/format';
import type { MailLogRow } from '../../types/mailroom';
import { MailLogActionBadge } from './MailLogActionBadge';
import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';

/*
 * The mobile presentation of the log — one card per closed item, replacing the
 * table below `md`.
 *
 * The mobile link draws the card exactly: the customer with their avatar
 * opposite the close date, a labelled "MAIL ITEM" block, a divider, then the
 * final-action badge opposite the processor under a "PROCESSED BY" label.
 *
 * The link has no "View" control on the card — the table has one in every row —
 * so the whole card is the target here (Design.md, filling in a state the
 * design did not cover). It is a button rather than a link because the detail
 * view opens as an overlay from the same screen.
 */

type MailLogCardListProps = {
  entries: MailLogRow[];
  onView: (entry: MailLogRow) => void;
};

export function MailLogCardList({ entries, onView }: MailLogCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            onClick={() => onView(entry)}
            aria-label={`View ${entry.mailItem} for ${entry.customer.name}`}
            className="flex w-full flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 text-left shadow-sm-elevation transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <MailOpsCustomerAvatar
                  id={entry.customer.id}
                  initials={entry.customer.initials}
                  className="size-6 text-[10px]"
                />
                <span className="truncate text-body font-semibold text-text">
                  {entry.customer.name}
                </span>
              </div>

              <span className="shrink-0 text-small text-text-secondary">
                {formatOrderDate(entry.closedAt)}
              </span>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-1">
              <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-400">
                Mail item
              </span>
              <span className="truncate text-body font-medium text-text">
                {entry.mailItem}
              </span>
            </div>

            <hr className="border-t border-gray-200" />

            <div className="flex items-center justify-between gap-3">
              <MailLogActionBadge
                action={entry.action}
                label={entry.actionLabel}
              />

              <div className="flex min-w-0 flex-col items-end gap-0.5">
                <span className="text-[10px] font-normal uppercase tracking-[0.4px] text-gray-400">
                  Processed by
                </span>
                <span className="truncate text-small font-medium text-text-secondary">
                  {entry.processedBy}
                </span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
