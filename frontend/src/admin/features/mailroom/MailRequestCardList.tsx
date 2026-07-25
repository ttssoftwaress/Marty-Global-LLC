import { formatOrderDate } from '../../lib/format';
import type { MailRequestRow } from '../../types/mailroom';
import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';
import {
  MailRequestStatusBadge,
  MailRequestTypeBadge,
} from './MailRequestBadges';
import { MailRequestRowAction } from './MailRequestRowAction';

/*
 * The mobile presentation of the queue — one card per request, replacing the
 * table below `md`.
 *
 * There is no mobile link for this screen, so the layout follows the pattern
 * the admin area already uses when a six-column table has to fit a 390px
 * screen (the billing ledger's `LedgerCardList` and the customers list):
 *   - the customer, with their avatar, opposite the status badge
 *   - the mail item as the card's heading line, since it is what identifies the
 *     row once the columns are gone
 *   - the request-type badge beside the date
 *   - a divider, then the action full-width as the card's one target
 *
 * The card is not itself a link — the action is the row's single target, which
 * keeps the text selectable.
 */

type MailRequestCardListProps = {
  requests: MailRequestRow[];
  processingId: string | null;
  onProcess: (request: MailRequestRow) => void;
  onView: (request: MailRequestRow) => void;
};

export function MailRequestCardList({
  requests,
  processingId,
  onProcess,
  onView,
}: MailRequestCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {requests.map((request) => (
        <li
          key={request.id}
          className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MailOpsCustomerAvatar
                id={request.customer.id}
                initials={request.customer.initials}
                className="size-7 text-[11px]"
              />
              <span className="truncate text-small font-medium text-text-secondary">
                {request.customer.name}
              </span>
            </div>

            <MailRequestStatusBadge
              status={request.status}
              label={request.statusLabel}
            />
          </div>

          <p className="text-body font-semibold text-text">{request.mailItem}</p>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <MailRequestTypeBadge type={request.type} label={request.typeLabel} />
            <p className="text-caption text-gray-400">
              {formatOrderDate(request.requestedAt)}
            </p>
          </div>

          <hr className="border-t border-gray-200" />

          <MailRequestRowAction
            request={request}
            isBusy={processingId === request.id}
            onProcess={onProcess}
            onView={onView}
            fullWidth
          />
        </li>
      ))}
    </ul>
  );
}
