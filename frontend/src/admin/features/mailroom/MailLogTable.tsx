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
import type { MailLogRow } from '../../types/mailroom';
import { MailLogActionBadge } from './MailLogActionBadge';
import { MailLogDetails } from './MailLogDetails';
import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';

/*
 * The mail log — the desktop and tablet presentation (mobile renders cards
 * instead; see MailLogCardList).
 *
 * One real `<table>` so the columns align, the header is announced, and the
 * badges line up under their headings.
 *
 * The two links differ in more than scale, and both are reproduced from one
 * markup:
 *   - desktop (lg): six columns — "Processed by" is a column of its own, 20px
 *     gutters, a 56px row
 *   - tablet (md):  five columns — the design drops the "Processed by" heading
 *     and folds the name under the date as a second "by …" line, which is what
 *     buys the room; 16px gutters, a 60px row
 *
 * `table-fixed` holds the column allocation at both widths so a long mail-item
 * title truncates instead of pushing the action off the edge. The widths sum to
 * the table's own minimum rather than overrunning it — a `table-fixed` table
 * whose columns are wider than the table scales every one of them down, and the
 * View button then sits under the date beside it.
 *
 * The desktop link zebra-stripes alternate rows. That reads as banding rather
 * than a state, but it fights the hover tint every other admin table uses, so
 * the rows are plain white with a real hover tint here (logged as a deviation).
 *
 * Clicking a row opens the question the log is actually read to answer — why
 * this post left the building: the item's own state, and every request the
 * customer raised against it. Fetched on expand (MailLogDetails), one row open
 * at a time. The View button keeps its own job and stops its own click.
 */

type MailLogTableProps = {
  entries: MailLogRow[];
  onView: (entry: MailLogRow) => void;
  selection: RowSelection;
  // False when the signed-in member may not delete here — the column is dropped
  // rather than drawn disabled, so nobody ticks rows they cannot act on.
  selectable: boolean;
};

export function MailLogTable({
  entries,
  onView,
  selection,
  selectable,
}: MailLogTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[45rem] table-fixed lg:min-w-[60rem]">
        <thead>
          <tr className="h-12">
            {selectable ? (
              <th scope="col" className="w-10 pl-4 pr-2 lg:pl-5">
                <RowCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  label="Select all log entries on this page"
                />
              </th>
            ) : null}

            <th
              scope="col"
              className={
                selectable
                  ? 'w-[11.25rem] pr-3 lg:w-[13.5rem] lg:pr-4'
                  : 'w-[11.25rem] pl-4 pr-3 lg:w-[13.5rem] lg:pl-5 lg:pr-4'
              }
            >
              Customer
            </th>
            <th scope="col" className="w-[11.25rem] pr-3 lg:w-[14rem] lg:pr-4">
              Mail item
            </th>
            <th
              scope="col"
              className="w-[9.375rem] pr-3 lg:w-[10.5rem] lg:pr-4"
            >
              Final action
            </th>
            <th
              scope="col"
              className="w-[8.125rem] pr-3 lg:w-[8.25rem] lg:pr-4"
            >
              Date closed
            </th>

            {/*
             * Tablet folds the processor under the date instead of giving it a
             * column, so the heading only exists from `lg` up.
             */}
            <th scope="col" className="hidden w-[7.5rem] pr-4 lg:table-cell">
              Processed by
            </th>

            <th
              scope="col"
              className="w-[5rem] pr-3 text-right lg:w-[6.25rem] lg:pr-4"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
            <th scope="col" className="w-[4rem] pr-4 lg:pr-5">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => {
            const isExpanded = entry.id === expandedId;
            const panelId = detailPanelId('mail-log', entry.id);

            return (
              <Fragment key={entry.id}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => toggle(entry.id),
                    label: `${isExpanded ? 'Hide' : 'Show'} history for ${entry.mailItem}`,
                  })}
                  className={`h-[3.75rem] lg:h-table-row ${expandedRowClass(isExpanded)}`}
                >
              {selectable ? (
                <td className="py-2 pl-4 pr-2 lg:pl-5" onClick={stopRowToggle}>
                  <RowCheckbox
                    checked={selection.isSelected(entry.id)}
                    onChange={() => selection.toggle(entry.id)}
                    label={`Select the log entry for ${entry.mailItem}`}
                  />
                </td>
              ) : null}

              <td className={`py-2 pr-3 lg:pr-4 ${selectable ? '' : 'pl-4 lg:pl-5'}`}>
                <div className="flex items-center gap-2 lg:gap-2.5">
                  <MailOpsCustomerAvatar
                    id={entry.customer.id}
                    initials={entry.customer.initials}
                    className="size-7 text-[0.6875rem] lg:size-6 lg:text-[0.625rem]"
                  />
                  {/*
                   * The room under the customer rather than in a column of its
                   * own: a customer may hold several, so the operator needs the
                   * address the item arrived at — but the design's column widths
                   * are fixed and another column would squeeze every one of them.
                   */}
                  <span className="flex min-w-0 flex-col">
                    <span
                      className="truncate text-[0.8125rem] font-medium lg:text-body lg:font-normal"
                      title={entry.customer.name}
                    >
                      {entry.customer.name}
                    </span>
                    <span className="truncate text-[0.6875rem] text-gray-400 lg:text-small">
                      {entry.room.name}
                    </span>
                  </span>
                </div>
              </td>

              <td className="py-2 pr-3 lg:pr-4">
                <span
                  className="block truncate text-[0.8125rem] lg:text-body lg:text-text-secondary"
                  title={entry.mailItem}
                >
                  {entry.mailItem}
                </span>
              </td>

              <td className="py-2 pr-3 lg:pr-4">
                <MailLogActionBadge
                  action={entry.action}
                  label={entry.actionLabel}
                />
              </td>

              <td className="py-2 pr-3 lg:pr-4">
                <span className="block truncate text-[0.8125rem] lg:text-body lg:text-text-secondary">
                  {formatOrderDate(entry.closedAt)}
                </span>

                {/* Tablet's second line; desktop shows this in its own column. */}
                <span className="block truncate text-caption text-text-secondary lg:hidden">
                  by {entry.processedBy}
                </span>
              </td>

              <td className="hidden py-2 pr-4 lg:table-cell">
                <span
                  className="block truncate text-text-secondary"
                  title={entry.processedBy}
                >
                  {entry.processedBy}
                </span>
              </td>

              <td
                className="py-2 pl-2 pr-3 lg:pr-4"
                onClick={stopRowToggle}
              >
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onView(entry)}
                    aria-label={`View ${entry.mailItem} for ${entry.customer.name}`}
                    className="flex h-8 items-center justify-center rounded-control border border-gray-200 bg-white px-3 text-[0.8125rem] font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:border-primary lg:px-4 lg:font-semibold"
                  >
                    View
                  </button>
                </div>
              </td>

                  <ExpandChevronCell
                    isExpanded={isExpanded}
                    className="py-2 pr-4 lg:pr-5"
                  />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={selectable ? 8 : 7}>
                    <MailLogDetails entry={entry} />
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
