import { Fragment } from 'react';
import { Check, Inbox, Loader2, RotateCcw } from 'lucide-react';

import {
  DetailRow,
  ExpandChevron,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { RowCheckbox } from '../../components/RowCheckbox';
import type { RowSelection } from '../../hooks/useRowSelection';
import { formatActivityTime, formatOrderDate } from '../../lib/format';
import { LeadDetails } from './LeadDetails';
import type { AdminLead } from './queries';

/*
 * The leads queue — two presentations of one list, the same table ⇄ card split
 * every other admin list uses. There is no detail screen: a lead is one record,
 * and it reads in the row it opens under.
 *
 * The row is what it is scanned by — who wrote in, a line of what they said,
 * when, and whether anyone has picked it up. Clicking it opens the message in
 * full, fetched then rather than shipped with the page (LeadDetails). One row
 * is open at a time; opening a second closes the first.
 *
 * "Mark handled" stops its own click so working the queue never also toggles a
 * panel — the two are different decisions and the button is the smaller target.
 * The tick box does the same, for the same reason.
 *
 * On mobile the tick sits OUTSIDE the card's button rather than inside it: the
 * card is one big `<button>`, and a checkbox nested in a button is invalid
 * markup that browsers resolve by dropping one of the two controls.
 */

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <Inbox
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body-lg font-semibold text-text">
        {hasFilter ? 'Nothing matches this view' : 'No open leads'}
      </p>
      <p className="max-w-[23.75rem] text-body text-gray-500">
        {hasFilter
          ? 'Try another status.'
          : 'Submissions from the marketing site’s contact form land here.'}
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-14 w-full animate-pulse rounded-input bg-gray-200"
        />
      ))}
    </div>
  );
}

type LeadsTableProps = {
  rows: AdminLead[];
  isLoading?: boolean;
  hasFilter: boolean;
  onToggleHandled: (lead: AdminLead) => void;
  pendingId?: string;
  selection: RowSelection;
  // False when the signed-in member may not delete here — the column is dropped
  // rather than drawn disabled, so nobody ticks rows they cannot act on.
  selectable: boolean;
};

function HandledButton({
  lead,
  onToggleHandled,
  pending,
}: {
  lead: AdminLead;
  onToggleHandled: (lead: AdminLead) => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        stopRowToggle(event);
        onToggleHandled(lead);
      }}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[0.625rem] border px-3.5 py-2 text-[0.8125rem] font-semibold transition-colors disabled:opacity-60 ${
        lead.handled
          ? 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          : 'border-primary bg-white text-primary hover:bg-primary-light'
      }`}
    >
      {pending ? (
        <Loader2
          className="size-4 animate-spin"
          strokeWidth={2}
          aria-hidden="true"
        />
      ) : lead.handled ? (
        <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
      )}
      {lead.handled ? 'Reopen' : 'Mark handled'}
    </button>
  );
}

export function LeadsTable({
  rows,
  isLoading,
  hasFilter,
  onToggleHandled,
  pendingId,
  selection,
  selectable,
}: LeadsTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  if (isLoading) {
    return (
      <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
        <SkeletonRows />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
        <EmptyState hasFilter={hasFilter} />
      </div>
    );
  }

  return (
    <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
      {/* --- Table: tablet and up ------------------------------------------ */}
      <div className="table-scroll hidden md:block">
        <table className="data-table min-w-[45rem]">
          <thead>
            <tr>
              {selectable ? (
                <th scope="col" className="w-[3rem] pl-card pr-0">
                  <RowCheckbox
                    checked={selection.allVisibleSelected}
                    indeterminate={selection.someVisibleSelected}
                    onChange={selection.toggleAllVisible}
                    label="Select all leads on this page"
                  />
                </th>
              ) : null}

              {['From', 'Message', 'Received', '', ''].map((heading, index) => (
                <th
                  key={heading || index}
                  scope="col"
                  className={`px-card ${index === 3 ? 'text-right' : ''} ${
                    index === 4 ? 'w-[4rem] pl-0' : ''
                  }`}
                >
                  {heading || (
                    <span className="sr-only">
                      {index === 3 ? 'Actions' : 'Details'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isExpanded = row.id === expandedId;
              const panelId = detailPanelId('lead', row.id);

              return (
                <Fragment key={row.id}>
                  <tr
                    {...expandRowProps({
                      isExpanded,
                      panelId,
                      onToggle: () => toggle(row.id),
                      label: `${isExpanded ? 'Hide' : 'Show'} the enquiry from ${row.name}`,
                    })}
                    className={expandedRowClass(isExpanded)}
                  >
                    {selectable ? (
                      <td
                        className="py-4 pl-card pr-0 align-top"
                        onClick={stopRowToggle}
                      >
                        <RowCheckbox
                          checked={selection.isSelected(row.id)}
                          onChange={() => selection.toggle(row.id)}
                          label={`Select the lead from ${row.name}`}
                        />
                      </td>
                    ) : null}

                    <td className="px-card py-4 align-top">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">{row.name}</span>
                        <a
                          href={`mailto:${row.email}`}
                          onClick={stopRowToggle}
                          className="text-caption text-primary underline-offset-2 hover:underline"
                        >
                          {row.email}
                        </a>
                      </span>
                    </td>

                    <td className="max-w-[24rem] px-card py-4 align-top">
                      <p className="line-clamp-1 text-text-secondary">
                        {row.preview}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-card py-4 align-top">
                      <span className="text-caption text-gray-500">
                        {formatActivityTime(row.createdAt)}
                      </span>
                    </td>

                    <td className="px-card py-4 text-right align-top">
                      <HandledButton
                        lead={row}
                        onToggleHandled={onToggleHandled}
                        pending={pendingId === row.id}
                      />
                    </td>

                    <td className="py-4 pl-0 pr-card align-top">
                      <div className="flex justify-end">
                        <ExpandChevron isExpanded={isExpanded} />
                      </div>
                    </td>
                  </tr>

                  {isExpanded ? (
                    <DetailRow panelId={panelId} colSpan={selectable ? 6 : 5}>
                      <LeadDetails lead={row} />
                    </DetailRow>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- Cards: mobile ------------------------------------------------- */}
      <ul className="flex flex-col md:hidden">
        {rows.map((row) => {
          const isExpanded = row.id === expandedId;
          const panelId = detailPanelId('lead-card', row.id);

          return (
            <li
              key={row.id}
              className="flex flex-col border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start">
                {selectable ? (
                  /* Padded to a comfortable touch target; the box itself stays
                     the 1rem the table draws. */
                  <span className="flex size-6 shrink-0 items-center justify-center pl-4 pt-4">
                    <RowCheckbox
                      checked={selection.isSelected(row.id)}
                      onChange={() => selection.toggle(row.id)}
                      label={`Select the lead from ${row.name}`}
                    />
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => toggle(row.id)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="flex min-w-0 flex-1 flex-col gap-3 p-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-body font-semibold text-text">
                        {row.name}
                      </span>
                      <span className="truncate text-caption text-primary">
                        {row.email}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-caption text-gray-500">
                        {formatOrderDate(row.createdAt)}
                      </span>
                      <ExpandChevron isExpanded={isExpanded} />
                    </span>
                  </span>

                  <span className="line-clamp-2 text-body text-text-secondary">
                    {row.preview}
                  </span>
                </button>
              </div>

              {isExpanded ? (
                <div id={panelId} className="border-t border-gray-200 bg-gray-50 p-4">
                  <LeadDetails lead={row} />
                </div>
              ) : null}

              <div className="px-4 pb-4">
                <HandledButton
                  lead={row}
                  onToggleHandled={onToggleHandled}
                  pending={pendingId === row.id}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
