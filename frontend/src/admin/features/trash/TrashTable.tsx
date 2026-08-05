import { AlertTriangle } from 'lucide-react';

import { RowCheckbox } from '../../components/RowCheckbox';
import { formatAuditTime } from '../../lib/format';
import type { RowSelection } from '../../hooks/useRowSelection';
import type { TrashEntry } from '../../types/trash';

/*
 * The Trash table — the tablet and desktop presentation (mobile renders cards;
 * see TrashCardList).
 *
 * One real `<table>` so the columns align and the values sit under their
 * headings. Five columns, and the two links differ only in what fits:
 *   - desktop (lg): tick, record, type, deleted by / when, and the countdown
 *   - tablet (md):  "Deleted by" folds into the same cell as the timestamp
 *
 * Rows do not navigate. Every record here is soft-deleted, so its own screen
 * would 404 on it — the row is the whole record until it is restored, which is
 * why the snapshot label and sublabel are printed rather than linked.
 *
 * THE COUNTDOWN IS THE POINT OF THE LAST COLUMN. "12 days left" is the only
 * thing on the row that changes on its own, and the day it reaches zero the
 * record stops existing — so it is tinted as it runs down rather than printed as
 * a neutral date an admin has to subtract from today.
 */

type TrashTableProps = {
  entries: TrashEntry[];
  selection: RowSelection;
  selectable: boolean;
};

// Under a week, the row is worth noticing; under two days it is the reason to
// have opened the screen.
function countdownTone(daysLeft: number): string {
  if (daysLeft <= 1) return 'text-error';
  if (daysLeft <= 7) return 'text-warning';
  return 'text-gray-500';
}

function countdownLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

export function TrashTable({ entries, selection, selectable }: TrashTableProps) {
  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[44rem] lg:min-w-[56rem]">
        <thead>
          <tr className="h-12">
            {selectable ? (
              <th scope="col" className="w-[3rem] pl-5 pr-0 lg:pl-card">
                <RowCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  label="Select all records on this page"
                />
              </th>
            ) : null}

            <th scope="col" className={selectable ? 'pl-3 pr-4' : 'pl-5 pr-4 lg:pl-card'}>
              Record
            </th>
            <th scope="col" className="w-[10rem] pr-4">
              Type
            </th>
            <th scope="col" className="w-[13rem] pr-4 lg:w-[15rem]">
              Deleted
            </th>
            <th scope="col" className="w-[9rem] pr-5 lg:pr-card">
              Permanently deleted
            </th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="h-table-row">
              {selectable ? (
                <td className="pl-5 pr-0 lg:pl-card">
                  <RowCheckbox
                    checked={selection.isSelected(entry.id)}
                    onChange={() => selection.toggle(entry.id)}
                    label={`Select ${entry.label}`}
                  />
                </td>
              ) : null}

              <td className={selectable ? 'pl-3 pr-4' : 'pl-5 pr-4 lg:pl-card'}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-semibold text-text">
                    {entry.label}
                  </span>
                  {entry.sublabel ? (
                    <span className="truncate text-caption text-gray-500">
                      {entry.sublabel}
                    </span>
                  ) : null}

                  {/*
                   * How far the delete reached. Printed on the row rather than
                   * behind an expander because it is what a restore will bring
                   * back — and what a permanent delete will take.
                   */}
                  {entry.cascadeCount > 0 ? (
                    <span className="text-caption text-gray-400">
                      + {entry.cascadeCount} related record
                      {entry.cascadeCount === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </span>
              </td>

              <td className="pr-4">
                <span className="inline-flex items-center rounded-pill bg-gray-100 px-2.5 py-1 text-caption font-medium text-gray-600">
                  {entry.entityLabel}
                </span>
              </td>

              <td className="pr-4">
                <span className="flex flex-col gap-0.5">
                  <span className="truncate text-body text-text">
                    {entry.deletedBy}
                  </span>
                  <span className="text-caption text-gray-500">
                    {formatAuditTime(entry.deletedAt)}
                  </span>
                </span>
              </td>

              <td className="pr-5 lg:pr-card">
                <span
                  className={`text-body font-medium ${countdownTone(entry.daysLeft)}`}
                >
                  {countdownLabel(entry.daysLeft)}
                </span>

                {/*
                 * A refused permanent delete. Not an error state — the record is
                 * safe, and the reason is usually a deliberate rule ("this staff
                 * account owns customer records"). It is on the row so nobody
                 * spends a week wondering why one entry never leaves.
                 */}
                {entry.purgeError ? (
                  <span className="mt-1 flex items-start gap-1.5 text-caption text-gray-500">
                    <AlertTriangle
                      className="mt-px size-3.5 shrink-0 text-warning"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {entry.purgeError}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
