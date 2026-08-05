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
import { RowActions } from '../../components/RowActions';
import { RowCheckbox } from '../../components/RowCheckbox';
import type { RowSelection } from '../../hooks/useRowSelection';
import { formatCatalogDate, formatTierCount } from '../../lib/catalog';
import type { CatalogServiceRow } from '../../types/catalog';
import { CatalogRowDetails } from './CatalogRowDetails';
import { RegionChipList } from './RegionChip';

/*
 * The catalog table — the `md` and up view, covering the tablet and desktop
 * links from one tree.
 *
 * The two links differ in exactly one way: desktop gives "Last updated" its own
 * column, while tablet folds the date under the tier count in the pricing cell
 * to buy width for the service name. So the date renders in both places and each
 * is hidden at the width where the other one shows — the same column-folding
 * approach the payments ledger uses at this breakpoint.
 *
 * Column widths are the design's fixed pixel values at `lg` and tablet's
 * narrower ones below, with the service name taking the remaining space. The
 * name truncates rather than wraps, which is what the tablet link shows, so the
 * row height stays on the design's grid regardless of how long a name is.
 *
 * Two departures from those widths, both to stop a cell overrunning its column
 * (Design.md — improve where warranted, log it): the actions column is 184px
 * rather than 150px, because it holds Manage plus a delete control that swaps to
 * a "Delete / Cancel" confirmation wider than either, and the table carries a
 * minimum width so the service name keeps a readable column instead of being
 * squeezed to nothing on a narrow workspace — it scrolls below that instead.
 *
 * Rows are semantic table markup, not divs, so the column headers are announced
 * with their cells.
 *
 * Clicking a row opens what a service actually is — the customer-facing
 * description, how many questions its form asks, and the facts it delivers —
 * fetched on expand through the same read the Manage form uses, so opening
 * Manage afterwards is served from cache. One row is open at a time, and the
 * action controls stop their own clicks.
 */

type CatalogTableProps = {
  rows: CatalogServiceRow[];
  onManage: (row: CatalogServiceRow) => void;
  onDelete: (row: CatalogServiceRow) => void;
  deletingId: string | null;
  selection: RowSelection;
  // False when the signed-in member may not delete here — the column is dropped
  // rather than drawn disabled, so nobody ticks rows they cannot act on.
  selectable: boolean;
};

export function CatalogTable({
  rows,
  onManage,
  onDelete,
  deletingId,
  selection,
  selectable,
}: CatalogTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <div className="table-scroll">
      <table className="data-table min-w-[46.5rem] table-fixed lg:min-w-[64rem]">
        <thead>
          <tr>
            {selectable ? (
              <th scope="col" className="h-12 w-[3rem] py-0 pl-6 pr-0">
                <RowCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  label="Select all services on this page"
                />
              </th>
            ) : null}

            <Th className="w-auto">Service name</Th>
            <Th className="w-[12.5rem] lg:w-[21.25rem]">Regions supported</Th>
            <Th className="w-[9.375rem]">Pricing tiers</Th>
            <Th className="hidden w-[8.75rem] lg:table-cell">Last updated</Th>
            {/* Wider than the design's 100px: the column now carries Delete beside
              Manage, and Delete's inline confirmation needs the room. */}
            <Th className="w-[11.5rem] text-right">Actions</Th>
            <Th className="w-[4rem]">
              <span className="sr-only">Details</span>
            </Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const isExpanded = row.id === expandedId;
            const panelId = detailPanelId('catalog', row.id);

            return (
              <Fragment key={row.id}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => toggle(row.id),
                    label: `${isExpanded ? 'Hide' : 'Show'} details for ${row.name}`,
                  })}
                  className={`h-20 lg:h-[4.5rem] ${expandedRowClass(isExpanded)}`}
                >
              {selectable ? (
                <td className="py-0 pl-6 pr-0" onClick={stopRowToggle}>
                  <RowCheckbox
                    checked={selection.isSelected(row.id)}
                    onChange={() => selection.toggle(row.id)}
                    label={`Select ${row.name}`}
                  />
                </td>
              ) : null}

              <td className="px-6 py-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold" title={row.name}>
                    {row.name}
                  </span>
                  {/*
                   * A deactivated service still lists — it keeps historical orders
                   * readable — so the row says so rather than looking identical to
                   * a live one. Not in the design; the catalog carries an `active`
                   * flag, and a row that customers cannot order has to be
                   * distinguishable. Logged as a deviation.
                   */}
                  {!row.active ? (
                    <span className="shrink-0 rounded-pill bg-gray-100 px-2 py-0.5 text-caption font-medium text-gray-500">
                      Inactive
                    </span>
                  ) : null}
                </div>
              </td>

              <td className="px-6 py-0">
                <RegionChipList regions={row.regions} size="sm" />
              </td>

              <td className="px-6 py-0">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium lg:font-normal lg:text-text-secondary">
                    {formatTierCount(row.tierCount)}
                  </span>
                  {/* Tablet folds the date here; desktop gives it a column. */}
                  <span className="text-caption text-text-secondary lg:hidden">
                    Updated {formatCatalogDate(row.updatedAt)}
                  </span>
                </div>
              </td>

              <td className="hidden whitespace-nowrap px-6 py-0 text-text-secondary lg:table-cell">
                {formatCatalogDate(row.updatedAt)}
              </td>

              <td className="px-6 py-0" onClick={stopRowToggle}>
                {/*
                 * Delete is absent rather than disabled once a customer has
                 * ordered the service — `canDelete` comes from the API, and the
                 * action for those is to turn the service off on its own screen.
                 */}
                {row.canDelete ? (
                  <RowActions
                    name={row.name}
                    isDeleting={deletingId === row.id}
                    onDelete={() => onDelete(row)}
                  >
                    <ManageButton row={row} onManage={onManage} />
                  </RowActions>
                ) : (
                  <div className="flex justify-end">
                    <ManageButton row={row} onManage={onManage} />
                  </div>
                )}
              </td>

                  <ExpandChevronCell isExpanded={isExpanded} className="px-6" />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={selectable ? 7 : 6}>
                    <CatalogRowDetails row={row} />
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

function ManageButton({
  row,
  onManage,
}: {
  row: CatalogServiceRow;
  onManage: (row: CatalogServiceRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onManage(row)}
      className="flex h-10 shrink-0 items-center rounded-control border border-primary bg-white px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Manage
      <span className="sr-only"> {row.name}</span>
    </button>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th scope="col" className={`h-12 px-6 py-0 ${className}`}>
      {children}
    </th>
  );
}
