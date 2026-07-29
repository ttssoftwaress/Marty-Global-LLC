import { ChevronRight, FolderOpen, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type {
  CustomerServiceSummary,
  ResultField,
  ServiceResultRow,
} from '../../types/my-services';
import { ResultValueView, resultValueText } from './ResultValueView';

/*
 * The customer's records for one service — two presentations of one list,
 * swapped by breakpoint (a table row cannot reflow into a card, so each renders
 * its own markup — the same approach the orders and mail lists take):
 *
 *   desktop (lg): the full table — every column the service's schema flags
 *   tablet (md):  the same table, folded to the primary + two columns, with the
 *                 rest stacked under the title so nothing is lost
 *   mobile:       one card per record, primary as the heading and the remaining
 *                 columns as label/value rows
 *
 * Nothing about the columns is hardcoded. `columns` arrives resolved from the
 * service's own result schema, so a service returning six facts renders six
 * columns and one returning two renders two — a catalog change, not a deploy.
 *
 * The first column is always the primary field: it is the record's title, and
 * what the whole row links through.
 */

type ResultListProps = {
  service: CustomerServiceSummary;
  columns: ResultField[];
  rows: ServiceResultRow[];
  isLoading?: boolean;
  hasFilter: boolean;
};

const recordHref = (resultId: string) => `/app/services/record/${resultId}`;

// The columns after the primary. The primary is rendered as the row's title, so
// repeating it as a cell would print it twice.
const secondaryColumns = (columns: ResultField[]) => columns.slice(1);

function ArchivedChip() {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-caption font-medium text-gray-500">
      Archived
    </span>
  );
}

function OpenRequestsChip({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-caption font-medium text-primary"
      title={`${count} open request${count === 1 ? '' : 's'}`}
    >
      <MessageSquare className="size-3" strokeWidth={2} aria-hidden="true" />
      {count}
    </span>
  );
}

function EmptyState({
  service,
  hasFilter,
}: {
  service: CustomerServiceSummary;
  hasFilter: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <FolderOpen className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">
        {hasFilter ? 'Nothing matches this view' : `No ${service.noun}s here yet`}
      </p>
      <p className="max-w-[23.75rem] text-body text-gray-500">
        {hasFilter
          ? 'Try another status or clear your search.'
          : `Once our team completes your ${service.name} order, the details will appear here.`}
      </p>
      {!hasFilter ? (
        <Link
          to="/app/orders"
          className="btn btn-secondary mt-1 h-11 rounded-input px-5 text-body"
        >
          View my orders
        </Link>
      ) : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-12 w-full animate-pulse rounded-input bg-gray-200" />
      ))}
    </div>
  );
}

function RowTitle({ row }: { row: ServiceResultRow }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className="text-body font-semibold text-text">{row.title}</span>
        {row.status === 'archived' ? <ArchivedChip /> : null}
        <OpenRequestsChip count={row.openRequests} />
      </span>
      <span className="text-caption text-gray-500">{row.reference}</span>
    </span>
  );
}

export function ResultList({
  service,
  columns,
  rows,
  isLoading,
  hasFilter,
}: ResultListProps) {
  const secondary = secondaryColumns(columns);

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
        <EmptyState service={service} hasFilter={hasFilter} />
      </div>
    );
  }

  return (
    <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
      {/* --- Table: tablet and up ------------------------------------------ */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                scope="col"
                className="px-card py-3 text-left text-caption font-semibold uppercase tracking-[0.4px] text-gray-500"
              >
                {columns[0]?.label ?? service.noun}
              </th>

              {/* Beyond the first, columns appear from `lg` — the tablet table
               * folds them under the title instead of scrolling sideways. */}
              {secondary.map((column) => (
                <th
                  key={column.name}
                  scope="col"
                  className="hidden px-card py-3 text-left text-caption font-semibold uppercase tracking-[0.4px] text-gray-500 lg:table-cell"
                >
                  {column.label}
                </th>
              ))}

              <th scope="col" className="px-card py-3 text-right">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
              >
                <td className="px-card py-4 align-top">
                  <Link to={recordHref(row.id)} className="block focus:outline-none">
                    <RowTitle row={row} />
                  </Link>

                  {/* Tablet only: the columns the table dropped, so the fold
                   * hides nothing. */}
                  {secondary.length > 0 ? (
                    <span className="mt-2 flex flex-col gap-1 lg:hidden">
                      {secondary.map((column) => (
                        <span key={column.name} className="flex items-baseline gap-1.5">
                          <span className="text-caption text-gray-500">
                            {column.label}:
                          </span>
                          <ResultValueView
                            field={column}
                            value={row.values[column.name]}
                            compact
                          />
                        </span>
                      ))}
                    </span>
                  ) : null}
                </td>

                {secondary.map((column) => (
                  <td
                    key={column.name}
                    className="hidden px-card py-4 align-top lg:table-cell"
                    title={resultValueText(column, row.values[column.name])}
                  >
                    <ResultValueView field={column} value={row.values[column.name]} compact />
                  </td>
                ))}

                <td className="px-card py-4 text-right align-top">
                  <Link
                    to={recordHref(row.id)}
                    className="inline-flex items-center justify-center rounded-[0.625rem] border border-primary bg-white px-4 py-2 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Cards: mobile ------------------------------------------------- */}
      <ul className="flex flex-col md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="border-b border-gray-100 last:border-b-0">
            <Link
              to={recordHref(row.id)}
              className="flex flex-col gap-3 p-4 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-start justify-between gap-3">
                <RowTitle row={row} />
                <ChevronRight
                  className="mt-0.5 size-5 shrink-0 text-gray-400"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>

              {secondary.length > 0 ? (
                <span className="flex flex-col gap-1.5">
                  {secondary.map((column) => (
                    <span
                      key={column.name}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="shrink-0 text-caption text-gray-500">
                        {column.label}
                      </span>
                      <span className="min-w-0 text-right">
                        <ResultValueView
                          field={column}
                          value={row.values[column.name]}
                          compact
                        />
                      </span>
                    </span>
                  ))}
                </span>
              ) : null}

              {row.deliveredAt ? (
                <span className="text-caption text-gray-500">
                  Delivered {formatOrderDate(row.deliveredAt)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
