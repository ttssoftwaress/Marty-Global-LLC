import { Fragment } from 'react';

import {
  DetailRow,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { RowCheckbox } from '../../components/RowCheckbox';
import type { RowSelection } from '../../hooks/useRowSelection';
import { formatOrderDate } from '../../lib/format';
import type { MailRequestRow } from '../../types/mailroom';
import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';
import {
  MailRequestStatusBadge,
  MailRequestTypeBadge,
} from './MailRequestBadges';
import { MailRequestRowAction } from './MailRequestRowAction';
import { MailRequestRowDetails } from './MailRequestRowDetails';

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
 *
 * Clicking a row EXPANDS it rather than opening the processing slide-over. An
 * operator working this queue usually needs to know what they are about to do —
 * which envelope, opened or sealed, and for a forwarding the address it is
 * going to — before committing to the form. The action button still opens the
 * slide-over and stops its own click, so processing is one press away. The
 * panel is fetched on expand, and one row is open at a time.
 */

type MailRequestsTableProps = {
  requests: MailRequestRow[];
  processingId: string | null;
  onOpen: (request: MailRequestRow) => void;
  selection: RowSelection;
  // False when the signed-in member may not delete here — the column is dropped
  // rather than drawn disabled, so nobody ticks rows they cannot act on.
  selectable: boolean;
};

export function MailRequestsTable({
  requests,
  processingId,
  onOpen,
  selection,
  selectable,
}: MailRequestsTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[42.5rem] table-fixed lg:min-w-[62rem]">
        <thead>
          <tr className="h-11 lg:h-12">
            {selectable ? (
              <th scope="col" className="w-10 pl-4 pr-2 lg:pl-6">
                <RowCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  label="Select all requests on this page"
                />
              </th>
            ) : null}

            <th
              scope="col"
              className={
                selectable
                  ? 'w-[8.75rem] pr-3 lg:w-[13.75rem] lg:pr-4'
                  : 'w-[8.75rem] pl-4 pr-3 lg:w-[13.75rem] lg:pl-6 lg:pr-4'
              }
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
              className="w-[5.5rem] pr-3 text-right lg:w-[8.25rem] lg:pr-4"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
            <th scope="col" className="w-[4rem] pr-4 lg:pr-6">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => {
            const isExpanded = request.id === expandedId;
            const panelId = detailPanelId('mail-request', request.id);

            return (
              <Fragment key={request.id}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => toggle(request.id),
                    label: `${isExpanded ? 'Hide' : 'Show'} details for ${request.mailItem}`,
                  })}
                  className={`h-[3.25rem] lg:h-table-row ${expandedRowClass(isExpanded)}`}
                >
              {selectable ? (
                <td className="py-2 pl-4 pr-2 lg:pl-6" onClick={stopRowToggle}>
                  <RowCheckbox
                    checked={selection.isSelected(request.id)}
                    onChange={() => selection.toggle(request.id)}
                    label={`Select the ${request.type} request for ${request.mailItem}`}
                  />
                </td>
              ) : null}

              <td className={`py-2 pr-3 lg:pr-4 ${selectable ? '' : 'pl-4 lg:pl-6'}`}>
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

              <td
                className="py-2 pl-2 pr-3 lg:pr-4"
                onClick={stopRowToggle}
              >
                <div className="flex justify-end">
                  <MailRequestRowAction
                    request={request}
                    isBusy={processingId === request.id}
                    onOpen={onOpen}
                  />
                </div>
              </td>

                  <ExpandChevronCell
                    isExpanded={isExpanded}
                    className="py-2"
                  />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={selectable ? 8 : 7}>
                    <MailRequestRowDetails request={request} onOpen={onOpen} />
                  </DetailRow>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
