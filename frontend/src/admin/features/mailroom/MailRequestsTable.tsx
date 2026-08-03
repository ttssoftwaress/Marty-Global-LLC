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
 * title truncates instead of pushing the action off the edge.
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

const HEAD_CELL =
  'px-0 py-0 text-left text-[0.625rem] font-semibold uppercase tracking-[0.5px] text-text-secondary lg:text-caption';

export function MailRequestsTable({
  requests,
  processingId,
  onOpen,
}: MailRequestsTableProps) {
  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[42.5rem] table-fixed border-collapse text-left lg:min-w-[62.5rem]">
        <thead>
          <tr className="h-11 border-b border-gray-200 bg-[var(--table-header-bg)] lg:h-12">
            <th
              scope="col"
              className={`${HEAD_CELL} w-[8.75rem] pl-4 pr-3 lg:w-[13.75rem] lg:pl-6 lg:pr-4`}
            >
              Customer
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[8.125rem] pr-3 lg:w-[15rem] lg:pr-4`}
            >
              Mail item
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[6.875rem] pr-3 lg:w-[11.25rem] lg:pr-4`}
            >
              Request type
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[5.625rem] pr-3 lg:w-[10rem] lg:pr-4`}
            >
              {/* Tablet abbreviates the heading; desktop spells it out. */}
              <span className="lg:hidden">Date</span>
              <span className="hidden lg:inline">Date requested</span>
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[6.25rem] pr-3 lg:w-[10rem] lg:pr-4`}
            >
              Status
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[5.5rem] pr-4 text-right lg:w-[7.75rem] lg:pr-6`}
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
              className="h-[3.25rem] cursor-pointer border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50 active:bg-gray-100 lg:h-table-row"
            >
              <td className="py-2 pl-4 pr-3 align-middle lg:pl-6 lg:pr-4">
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
                    <span className="truncate text-[0.8125rem] font-medium text-text lg:text-body">
                      {request.customer.name}
                    </span>
                    <span className="truncate text-[0.6875rem] text-gray-400 lg:text-small">
                      {request.room.name}
                    </span>
                  </span>
                </div>
              </td>

              <td className="py-2 pr-3 align-middle lg:pr-4">
                <span className="block truncate text-[0.8125rem] text-text lg:text-body">
                  {request.mailItem}
                </span>
              </td>

              <td className="py-2 pr-3 align-middle lg:pr-4">
                <MailRequestTypeBadge
                  type={request.type}
                  label={request.typeLabel}
                />
              </td>

              <td className="py-2 pr-3 align-middle lg:pr-4">
                <span className="whitespace-nowrap text-[0.8125rem] text-text-secondary lg:text-body">
                  {formatOrderDate(request.requestedAt)}
                </span>
              </td>

              <td className="py-2 pr-3 align-middle lg:pr-4">
                <MailRequestStatusBadge
                  status={request.status}
                  label={request.statusLabel}
                />
              </td>

              <td className="py-2 pl-2 pr-4 align-middle lg:pr-6">
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
