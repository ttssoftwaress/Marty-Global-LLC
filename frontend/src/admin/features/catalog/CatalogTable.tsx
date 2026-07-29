import { RowActions } from '../../components/RowActions';
import { formatCatalogDate, formatTierCount } from '../../lib/catalog';
import type { CatalogServiceRow } from '../../types/catalog';
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
 * Rows are semantic table markup, not divs, so the column headers are announced
 * with their cells.
 */

type CatalogTableProps = {
  rows: CatalogServiceRow[];
  onManage: (row: CatalogServiceRow) => void;
  onDelete: (row: CatalogServiceRow) => void;
  deletingId: string | null;
};

export function CatalogTable({
  rows,
  onManage,
  onDelete,
  deletingId,
}: CatalogTableProps) {
  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="border-b border-gray-200 bg-[var(--table-header-bg)]">
          <Th className="w-auto">Service name</Th>
          <Th className="w-[12.5rem] lg:w-[21.25rem]">Regions supported</Th>
          <Th className="w-[9.375rem]">Pricing tiers</Th>
          <Th className="hidden w-[8.75rem] lg:table-cell">Last updated</Th>
          {/* Wider than the design's 100px: the column now carries Delete beside
              Manage, and Delete's inline confirmation needs the room. */}
          <Th className="w-[9.375rem] text-right">Actions</Th>
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="h-20 border-b border-gray-200 last:border-b-0 lg:h-[4.5rem]"
          >
            <td className="px-6">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-body font-semibold text-text">
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

            <td className="px-6">
              <RegionChipList regions={row.regions} size="sm" />
            </td>

            <td className="px-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-body font-medium text-text lg:font-normal lg:text-text-secondary">
                  {formatTierCount(row.tierCount)}
                </span>
                {/* Tablet folds the date here; desktop gives it a column. */}
                <span className="text-caption text-text-secondary lg:hidden">
                  Updated {formatCatalogDate(row.updatedAt)}
                </span>
              </div>
            </td>

            <td className="hidden px-6 text-body text-text-secondary lg:table-cell">
              {formatCatalogDate(row.updatedAt)}
            </td>

            <td className="px-6">
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
          </tr>
        ))}
      </tbody>
    </table>
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
    <th
      scope="col"
      className={`h-12 px-6 text-left text-caption font-medium uppercase tracking-[0.4px] text-gray-500 ${className}`}
    >
      {children}
    </th>
  );
}
