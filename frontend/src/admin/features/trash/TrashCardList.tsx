import { AlertTriangle } from 'lucide-react';

import { RowCheckbox } from '../../components/RowCheckbox';
import { formatAuditTime } from '../../lib/format';
import type { RowSelection } from '../../hooks/useRowSelection';
import type { TrashEntry } from '../../types/trash';

/*
 * The mobile presentation of the Trash — one card per deleted record, on the
 * page background with no frame around the stack, matching the other admin
 * lists.
 *
 * The table's five columns become two lines and a footer row: the record and its
 * type up top, who deleted it and when beneath, and the countdown pinned to the
 * right where the table puts it. Nothing is dropped — a phone is where somebody
 * checks whether a record is still recoverable, so the one figure that answers
 * that stays the most prominent thing on the card.
 */

function countdownTone(daysLeft: number): string {
  if (daysLeft <= 1) return 'text-error';
  if (daysLeft <= 7) return 'text-warning';
  return 'text-gray-500';
}

function countdownLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Today';
  return `${daysLeft}d left`;
}

type TrashCardListProps = {
  entries: TrashEntry[];
  selection: RowSelection;
  selectable: boolean;
};

export function TrashCardList({
  entries,
  selection,
  selectable,
}: TrashCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
        >
          <div className="flex items-start gap-3">
            {selectable ? (
              /* Padded out to a comfortable touch target; the box itself stays
                 the 1rem the tables are drawn at. */
              <span className="flex size-6 shrink-0 items-center justify-center">
                <RowCheckbox
                  checked={selection.isSelected(entry.id)}
                  onChange={() => selection.toggle(entry.id)}
                  label={`Select ${entry.label}`}
                />
              </span>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate text-body font-semibold text-text">
                {entry.label}
              </p>
              {entry.sublabel ? (
                <p className="truncate text-caption text-gray-500">
                  {entry.sublabel}
                </p>
              ) : null}
            </div>

            <span
              className={`shrink-0 text-caption font-semibold ${countdownTone(entry.daysLeft)}`}
            >
              {countdownLabel(entry.daysLeft)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-pill bg-gray-100 px-2.5 py-1 text-caption font-medium text-gray-600">
              {entry.entityLabel}
            </span>

            {entry.cascadeCount > 0 ? (
              <span className="text-caption text-gray-400">
                + {entry.cascadeCount} related
              </span>
            ) : null}
          </div>

          <p className="text-caption text-gray-500">
            Deleted by {entry.deletedBy} · {formatAuditTime(entry.deletedAt)}
          </p>

          {entry.purgeError ? (
            <p className="flex items-start gap-1.5 text-caption text-gray-500">
              <AlertTriangle
                className="mt-px size-3.5 shrink-0 text-warning"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {entry.purgeError}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
