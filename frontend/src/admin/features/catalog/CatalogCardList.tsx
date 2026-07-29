import { RowActions } from '../../components/RowActions';
import { formatCatalogDate, formatTierCount } from '../../lib/catalog';
import type { CatalogServiceRow } from '../../types/catalog';
import { RegionChipList } from './RegionChip';

/*
 * The mobile view — the same rows as one card each, on the page background.
 *
 * Each card is the table row unstacked in the mobile link's order: name, the
 * wrapping region chips, one meta line pairing the tier count with the updated
 * date ("4 pricing tiers • Updated Jul 8, 2026"), then a full-width Manage
 * button.
 *
 * Delete sits in the card's top-right rather than beside Manage: the mobile link
 * gives Manage the full width, and pairing a primary action with a destructive
 * one on the same line is exactly where a mis-tap happens.
 */

type CatalogCardListProps = {
  rows: CatalogServiceRow[];
  onManage: (row: CatalogServiceRow) => void;
  onDelete: (row: CatalogServiceRow) => void;
  deletingId: string | null;
};

export function CatalogCardList({
  rows,
  onManage,
  onDelete,
  deletingId,
}: CatalogCardListProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <article
          key={row.id}
          className="flex w-full flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
        >
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-[0.9375rem] font-semibold leading-tight text-text">
              {row.name}
            </h3>
            {!row.active ? (
              <span className="shrink-0 rounded-pill bg-gray-100 px-2 py-0.5 text-caption font-medium text-gray-500">
                Inactive
              </span>
            ) : null}

            {row.canDelete ? (
              <RowActions
                name={row.name}
                isDeleting={deletingId === row.id}
                onDelete={() => onDelete(row)}
              />
            ) : null}
          </div>

          <RegionChipList regions={row.regions} />

          <p className="text-caption text-gray-500">
            {formatTierCount(row.tierCount)} &bull; Updated{' '}
            {formatCatalogDate(row.updatedAt)}
          </p>

          <button
            type="button"
            onClick={() => onManage(row)}
            className="mt-1 flex h-10 w-full items-center justify-center rounded-control border-[1.5px] border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Manage
            <span className="sr-only"> {row.name}</span>
          </button>
        </article>
      ))}
    </div>
  );
}
