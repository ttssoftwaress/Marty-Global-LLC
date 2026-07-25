import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

import type { OrderFilterOptions, OrderFilters } from '../../types/orders';
import { DEFAULT_ORDER_FILTERS } from '../../types/orders';
import { OrderFilterDropdown } from './OrderFilterDropdown';
import { OrderFilterSheet } from './OrderFilterSheet';

/*
 * The queue toolbar — search plus the three filters, arranged per link:
 *   - desktop (lg): search (320px) and the three dropdowns on one row
 *   - tablet (md):  full-width search on its own row, then the three dropdowns
 *                   sharing the next row equally
 *   - mobile:       search beside a square filter button that opens the sheet
 *
 * The dropdowns' open panels are our design (the links only show them closed) —
 * see OrderFilterDropdown. Mobile routes the same three filters through the
 * bottom sheet from its own link instead.
 *
 * Search is a controlled field the page debounces into the query; the backend
 * resolves the actual matching (AGENTS.md). Placeholder copy follows the
 * desktop link, which is the copy source across the three.
 */

type OrdersToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  options: OrderFilterOptions;
};

export function OrdersToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  options,
}: OrdersToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const setField = (field: keyof OrderFilters) => (value: string) =>
    onFiltersChange({ ...filters, [field]: value });

  // Flags the mobile filter button when the sheet is holding a narrowed filter,
  // which is otherwise invisible with the dropdowns off screen.
  const hasActiveFilter = (
    Object.keys(DEFAULT_ORDER_FILTERS) as (keyof OrderFilters)[]
  ).some((key) => filters[key] !== DEFAULT_ORDER_FILTERS[key]);

  const searchField = (
    <div className="flex h-12 items-center gap-2 rounded-input border border-gray-300 bg-gray-100 px-3 focus-within:border-primary focus-within:bg-white focus-within:shadow-[0_0_0_1px_var(--ring-focus)] md:h-10 md:bg-white">
      <Search className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by name, order ID..."
        aria-label="Search orders by name or order ID"
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
      />
    </div>
  );

  return (
    <>
      {/* Tablet & desktop — search with the three dropdowns beside it (lg) or
          on a second row (md). */}
      <div className="hidden w-full flex-col gap-3 md:flex lg:flex-row lg:items-center lg:gap-4">
        <div className="w-full lg:w-[320px] lg:shrink-0">{searchField}</div>

        <div className="grid grid-cols-3 gap-3 lg:flex lg:gap-4">
          <OrderFilterDropdown
            label="Service"
            options={options.services}
            value={filters.service}
            onChange={setField('service')}
            className="lg:w-[160px]"
          />
          <OrderFilterDropdown
            label="Region"
            options={options.regions}
            value={filters.region}
            onChange={setField('region')}
            className="lg:w-[160px]"
          />
          <OrderFilterDropdown
            label="Date range"
            options={options.dateRanges}
            value={filters.dateRange}
            onChange={setField('dateRange')}
            className="lg:w-[160px]"
          />
        </div>
      </div>

      {/* Mobile — search beside the sheet trigger. */}
      <div className="flex w-full items-center gap-2 md:hidden">
        <div className="min-w-0 flex-1">{searchField}</div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Filter orders"
          aria-expanded={sheetOpen}
          className="relative flex size-12 shrink-0 items-center justify-center rounded-input border-[1.5px] border-primary bg-white text-primary transition-colors hover:bg-primary-light"
        >
          <SlidersHorizontal className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {hasActiveFilter ? (
            <span
              aria-hidden="true"
              className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-accent"
            />
          ) : null}
        </button>
      </div>

      <OrderFilterSheet
        open={sheetOpen}
        options={options}
        filters={filters}
        onApply={(next) => {
          onFiltersChange(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
