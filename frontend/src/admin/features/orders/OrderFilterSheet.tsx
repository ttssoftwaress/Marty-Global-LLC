import { useEffect, useRef, useState } from 'react';

import { useOverlay } from '../../../hooks/useOverlay';
import type { OrderFilterOptions, OrderFilters } from '../../types/orders';
import { DEFAULT_ORDER_FILTERS } from '../../types/orders';
import { OrderFilterDropdown } from './OrderFilterDropdown';

/*
 * The mobile filter sheet — the bottom-up panel the filter button opens, built
 * to its own Figma link: a grabber, "Filter orders", the three labelled
 * dropdowns (Service / Region / Date range), and a footer pairing a quiet
 * "Reset" with the navy "Apply filters".
 *
 * The sheet edits a local draft and only lifts it on Apply, which is what the
 * two footer buttons imply — so scrolling through options never re-fetches the
 * queue mid-thought. Reset returns the draft to the pass-through values without
 * closing, leaving Apply as the single commit point. Opening the sheet re-seeds
 * the draft from the live filters, so a dismissed edit is discarded.
 *
 * The backdrop closes it, and `useOverlay` owns the rest of the modal
 * behaviour: Escape, the body scroll lock that stops the page behind moving
 * under the panel, focus moving into the sheet on open and back to the filter
 * button on close, and the Tab trap while it is up.
 */

type OrderFilterSheetProps = {
  open: boolean;
  options: OrderFilterOptions;
  filters: OrderFilters;
  onApply: (filters: OrderFilters) => void;
  onClose: () => void;
};

export function OrderFilterSheet({
  open,
  options,
  filters,
  onApply,
  onClose,
}: OrderFilterSheetProps) {
  const [draft, setDraft] = useState<OrderFilters>(filters);
  const panelRef = useRef<HTMLDivElement>(null);

  // Re-seed on open so the sheet always reflects what is actually applied.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  useOverlay({ open, onClose, panelRef });

  if (!open) return null;

  const setField = (field: keyof OrderFilters) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        data-press="none"
        className="absolute inset-0 cursor-default bg-gray-900/40 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filter orders"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] translate-y-0 flex-col rounded-t-modal bg-white shadow-lg-elevation outline-none transition-transform duration-300 ease-out starting:translate-y-full motion-reduce:transition-none"
      >
        <div className="flex justify-center pb-1 pt-3">
          <span aria-hidden="true" className="h-1 w-9 rounded-pill bg-gray-300" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
          <h2 className="text-h5 text-text">Filter orders</h2>

          <div className="flex flex-col gap-5 pt-5">
            <FilterField label="Service">
              <OrderFilterDropdown
                label="Service"
                options={options.services}
                value={draft.service}
                onChange={setField('service')}
              />
            </FilterField>

            <FilterField label="Region">
              <OrderFilterDropdown
                label="Region"
                options={options.regions}
                value={draft.region}
                onChange={setField('region')}
              />
            </FilterField>

            <FilterField label="Date range">
              <OrderFilterDropdown
                label="Date range"
                options={options.dateRanges}
                value={draft.dateRange}
                onChange={setField('dateRange')}
              />
            </FilterField>
          </div>
        </div>

        {/* Footer sits above the safe area so Apply clears a home indicator. */}
        <div className="flex items-center gap-3 border-t border-gray-200 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_ORDER_FILTERS)}
            className="shrink-0 rounded-input px-4 py-3 text-body font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-text"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex h-input flex-1 items-center justify-center rounded-input bg-primary text-body-lg font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-form-label text-text">{label}</span>
      {children}
    </div>
  );
}
