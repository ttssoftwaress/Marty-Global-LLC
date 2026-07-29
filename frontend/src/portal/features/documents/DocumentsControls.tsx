import { ChevronDown, Search } from 'lucide-react';

import type {
  DocumentSort,
  DocumentSourceFilter,
} from '../../types/documents';

/*
 * The documents toolbar — source filter, search, and sort — arranged per link:
 *   - desktop (lg): source tabs and (search + sort dropdown) share one
 *                   justify-between row
 *   - tablet (md):  source tabs on their own full-width row, then search + sort
 *   - mobile:       a scrollable row of source pills, then search + sort beneath
 *
 * The source filter is a pill/tab strip rather than a second dropdown because it
 * is the primary way this list is narrowed — a customer looking for "the mail
 * scan" wants one tap, not a menu. Search and sort are real controls; the
 * backend resolves the actual filtering (AGENTS.md).
 */

const SOURCE_OPTIONS: { value: DocumentSourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'record', label: 'Records' },
  { value: 'mail', label: 'Mail' },
];

const SORT_OPTIONS: { value: DocumentSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
];

type DocumentsControlsProps = {
  source: DocumentSourceFilter;
  onSourceChange: (source: DocumentSourceFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: DocumentSort;
  onSortChange: (sort: DocumentSort) => void;
};

function SourceTabs({
  source,
  onSourceChange,
  className,
}: {
  source: DocumentSourceFilter;
  onSourceChange: (source: DocumentSourceFilter) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter by source"
      className={`flex items-center gap-2 ${className ?? ''}`}
    >
      {SOURCE_OPTIONS.map(({ value, label }) => {
        const isActive = value === source;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSourceChange(value)}
            className={`shrink-0 rounded-pill px-4 py-2 text-body font-medium transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex h-10 items-center gap-2 rounded-input border border-gray-300 bg-white px-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] ${className ?? ''}`}
    >
      <Search
        className="size-4 shrink-0 text-gray-400"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search documents…"
        aria-label="Search documents by name"
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
      />
    </div>
  );
}

function SortSelect({
  sort,
  onSortChange,
  className,
}: {
  sort: DocumentSort;
  onSortChange: (sort: DocumentSort) => void;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className ?? ''}`}>
      <select
        value={sort}
        onChange={(event) => onSortChange(event.target.value as DocumentSort)}
        aria-label="Sort documents"
        className="h-10 w-full cursor-pointer appearance-none rounded-input border border-gray-300 bg-white pl-3.5 pr-9 text-body text-gray-700 outline-none focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)] md:w-[10.5rem]"
      >
        {SORT_OPTIONS.map((option) => (
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
  );
}

export function DocumentsControls({
  source,
  onSourceChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: DocumentsControlsProps) {
  return (
    <>
      {/* Tablet & desktop */}
      <div className="hidden md:flex md:flex-col md:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SourceTabs source={source} onSourceChange={onSourceChange} />
        <div className="flex w-full items-center gap-3 lg:w-auto">
          <SearchField
            value={search}
            onChange={onSearchChange}
            className="flex-1 lg:w-[15rem] lg:flex-none"
          />
          <SortSelect sort={sort} onSortChange={onSortChange} />
        </div>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-3 md:hidden">
        <SourceTabs
          source={source}
          onSourceChange={onSourceChange}
          className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />
        <SearchField
          value={search}
          onChange={onSearchChange}
          className="h-11"
        />
        <SortSelect sort={sort} onSortChange={onSortChange} className="w-full" />
      </div>
    </>
  );
}
