import { ChevronDown, Download, Search } from 'lucide-react';

import type { PaymentHistoryRange } from '../../types/billing';

/*
 * The payment-history control row: search, a time-range filter, and Export CSV.
 * Search and the range filter sit inline at every width; Export is tablet-and-up
 * only, since a CSV download is not a phone action.
 *
 * Search and the range select are real controls so the page is usable, not a
 * static pill — the backend resolves the actual filtering. Export runs a
 * server-side CSV of the visible history.
 */

const RANGE_OPTIONS: { value: PaymentHistoryRange; label: string }[] = [
  { value: '12m', label: 'Last 12 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

type PaymentHistoryControlsProps = {
  search: string;
  onSearchChange: (value: string) => void;
  range: PaymentHistoryRange;
  onRangeChange: (range: PaymentHistoryRange) => void;
  onExport?: () => void;
};

export function PaymentHistoryControls({
  search,
  onSearchChange,
  range,
  onRangeChange,
  onExport,
}: PaymentHistoryControlsProps) {
  return (
    <div className="flex w-full items-center gap-2 md:gap-3 lg:w-auto lg:justify-end">
      {/* Search — full width on mobile/tablet, fixed on desktop */}
      <div className="flex h-12 flex-1 items-center gap-2 rounded-input border border-gray-300 bg-white px-3 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] md:h-10 md:px-3.5 lg:w-[240px] lg:flex-none">
        <Search className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search payments…"
          aria-label="Search payments"
          className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
        />
      </div>

      {/* Time-range filter — every breakpoint. The design collapses it behind a
       * filter button on mobile, but that button had nothing to open, leaving
       * phones unable to change the range at all; showing the real control is
       * the smaller deviation. */}
      <div className="relative shrink-0">
        <select
          value={range}
          onChange={(event) => onRangeChange(event.target.value as PaymentHistoryRange)}
          aria-label="Payment time range"
          className="h-12 w-[132px] cursor-pointer appearance-none rounded-input border border-gray-300 bg-white pl-3.5 pr-9 text-body text-gray-800 outline-none focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)] md:h-10 md:w-auto"
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>

      {/* Export CSV — tablet & desktop */}
      <button
        type="button"
        onClick={onExport}
        className="hidden h-10 items-center gap-2 rounded-input border border-primary bg-white px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light md:inline-flex"
      >
        <Download className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Export CSV
      </button>

    </div>
  );
}
