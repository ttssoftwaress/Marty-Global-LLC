import { Search } from 'lucide-react';

import type { ServiceResultStatus } from '../../types/my-services';

/*
 * The list page's two controls: the status tabs and the search box.
 *
 * Both are lifted state owned by the page, because both are part of the query
 * key — changing either fetches a new page rather than filtering in the browser,
 * which is what keeps a customer with two hundred records honest.
 */

export type ResultStatusFilter = ServiceResultStatus | 'all';

const TABS: { value: ResultStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  // A dissolved company or a lapsed registration. Still readable, deliberately
  // behind its own tab rather than mixed into the live list.
  { value: 'archived', label: 'Archived' },
];

type ResultListControlsProps = {
  status: ResultStatusFilter;
  onStatusChange: (status: ResultStatusFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  noun: string;
  totalResults: number;
};

export function ResultListControls({
  status,
  onStatusChange,
  search,
  onSearchChange,
  noun,
  totalResults,
}: ResultListControlsProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <div
        role="tablist"
        aria-label="Filter records by status"
        className="flex w-full items-center gap-1 overflow-x-auto rounded-input bg-gray-100 p-1 md:w-auto"
      >
        {TABS.map((tab) => {
          const active = tab.value === status;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onStatusChange(tab.value)}
              className={`flex-1 whitespace-nowrap rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-colors md:flex-none ${
                active
                  ? 'bg-white text-text shadow-sm-elevation'
                  : 'text-gray-500 hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex w-full items-center gap-3 md:w-auto">
        <label className="relative flex w-full items-center md:w-[280px]">
          <span className="sr-only">Search {noun}s</span>
          <Search
            className="pointer-events-none absolute left-3 size-4 text-gray-400"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={`Search ${noun}s`}
            className="h-11 w-full rounded-input border border-gray-200 bg-white pl-9 pr-3 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>

        {/* The count is the backend's total for the current filter, not the
         * loaded page — a cursor stream would otherwise under-report it. */}
        <span className="hidden shrink-0 text-body text-gray-500 lg:inline">
          {totalResults} {totalResults === 1 ? noun : `${noun}s`}
        </span>
      </div>
    </div>
  );
}
