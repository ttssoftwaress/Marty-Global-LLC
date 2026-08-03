import { formatOrderDate } from '../../lib/format';
import type { MailRequestRow } from '../../types/mailroom';
import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';
import {
  MailRequestStatusBadge,
  MailRequestTypeBadge,
} from './MailRequestBadges';
import { MailRequestRowAction } from './MailRequestRowAction';

/*
 * The pending-requests queue — the desktop and tablet presentation (mobile
 * renders cards instead; see MailRequestCardList).
 *
 * One real `<table>` so the six columns align, the header is announced, and the
 * badges line up under their headings.
 *
 * Both links show the same six columns and differ only in scale, which the same
 * markup covers:
 *   - desktop (lg): 24px gutters, a 56px row, 11px uppercase headings, and the
 *     "Date requested" heading spelled out
 *   - tablet (md):  16px gutters, a 52px row, 10px headings, and the date
 *     column abbreviated to "Date" — the design's own wording at that width
 *
 * `table-fixed` holds the column allocation at both widths so a long mail-item
 * title truncates instead of pushing the action off the edge. The widths sum to
 * the table's own minimum rather than overrunning it — a `table-fixed` table
 * whose columns are wider than the table scales every one of them down, which is
 * how the action button ended up under the status badge beside it.
 *
 * The design zebra-stripes the second row only, which reads as a hover state
 * rendered into the mockup rather than banding — the rows are plain white here
 * with a real hover tint instead (logged as a deviation).
 */

type MailRequestsTableProps = {
  requests: MailRequestRow[];
  processingId: string | null;
  onOpen: (request: MailRequestRow) => void;
};

export function MailRequestsTable({
  requests,
  processingId,
  onOpen,
}: MailRequestsTableProps) {
  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[42.5rem] table-fixed lg:min-w-[62rem]">
        <thead>
          <tr className="h-11 lg:h-12">
            <th
              scope="col"
              className="w-[8.75rem] pl-4 pr-3 lg:w-[13.75rem] lg:pl-6 lg:pr-4"
            >
              Customer
            </th>
            <th scope="col" className="w-[8.125rem] pr-3 lg:w-[13rem] lg:pr-4">
              Mail item
            </th>
            <th scope="col" className="w-[6.875rem] pr-3 lg:w-[9.5rem] lg:pr-4">
              Request type
            </th>
            <th scope="col" className="w-[5.625rem] pr-3 lg:w-[8.5rem] lg:pr-4">
              {/* Tablet abbreviates the heading; desktop spells it out. */}
              <span className="lg:hidden">Date</span>
              <span className="hidden lg:inline">Date requested</span>
            </th>
            <th scope="col" className="w-[6.25rem] pr-3 lg:w-[9rem] lg:pr-4">
              Status
            </th>
            <th
              scope="col"
              className="w-[5.5rem] pr-4 text-right lg:w-[8.25rem] lg:pr-6"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {/*
           * The whole row opens the request, not just the button in the last
           * column — the operator reads the row and expects to click it. The
           * button stays as the explicit, keyboard-reachable target; this only
           * widens where a pointer may land, so no keyboard handler is added
           * here (it would duplicate the button in the tab order).
           */}
          {requests.map((request) => (
            <tr
              key={request.id}
              onClick={() => onOpen(request)}
              className="h-[3.25rem] cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100 lg:h-table-row"
            >
              <td className="py-2 pl-4 pr-3 lg:pl-6 lg:pr-4">
                <div className="flex items-center gap-2 lg:gap-2.5">
                  <MailOpsCustomerAvatar
                    id={request.customer.id}
                    initials={request.customer.initials}
                    className="size-6 text-[0.625rem]"
                  />
                  {/*
                   * The room under the customer rather than in a column of its
                   * own: a customer may hold several, so the operator needs the
                   * address the item arrived at — but the design's column widths
                   * are fixed and a sixth column would squeeze every one of them.
                   */}
                  <span className="flex min-w-0 flex-col">
                    <span
                      className="truncate text-[0.8125rem] font-medium lg:text-body"
                      title={request.customer.name}
                    >
                      {request.customer.name}
                    </span>
                    <span className="truncate text-[0.6875rem] text-gray-400 lg:text-small">
                      {request.room.name}
                    </span>
                  </span>
                </div>
              </td>

              <td className="py-2 pr-3 lg:pr-4">
                <span
                  className="block truncate text-[0.8125rem] lg:text-body"
                  title={request.mailItem}
                >
                  {request.mailItem}
                </span>
              </td>

              <td className="py-2 pr-3 lg:pr-4">
                <MailRequestTypeBadge
                  type={request.type}
                  label={request.typeLabel}
                />
              </td>

              <td className="py-2 pr-3 lg:pr-4">
                <span className="block truncate text-[0.8125rem] text-text-secondary lg:text-body">
                  {formatOrderDate(request.requestedAt)}
                </span>
              </td>

              <td className="py-2 pr-3 lg:pr-4">
                <MailRequestStatusBadge
                  status={request.status}
                  label={request.statusLabel}
                />
              </td>

              <td className="py-2 pl-2 pr-4 lg:pr-6">
                <div className="flex justify-end">
                  <MailRequestRowAction
                    request={request}
                    isBusy={processingId === request.id}
                    onOpen={onOpen}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
