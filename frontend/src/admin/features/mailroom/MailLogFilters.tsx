import { Search } from 'lucide-react';

import {
  MAIL_LOG_ACTION_FILTERS,
  MAIL_LOG_DATE_RANGES,
  type MailLogActionFilter,
  type MailLogDateRange,
} from '../../types/mailroom';
import { MailLogFilterSelect } from './MailLogFilterSelect';

/*
 * The log's filter strip — a customer search beside the date-range and
 * request-type selects.
 *
 * The three links arrange the same three controls differently, and each is
 * reproduced:
 *   - desktop: one row, the search fixed at 280px and each select at 160px, all
 *     hugging left
 *   - tablet:  one row that wraps, the search taking the free space with a
 *     180px floor and the selects hugging their labels
 *   - mobile:  the search on its own full-width line, the two selects sharing
 *     the line beneath it
 *
 * Search is controlled here and debounced by the panel into the server-side
 * query; the backend resolves the matching (AGENTS.md). Placeholder copy is the
 * desktop link's "Search customers..." at all three widths (Design.md — desktop
 * owns the wording).
 */

type MailLogFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  range: MailLogDateRange;
  onRangeChange: (value: MailLogDateRange) => void;
  action: MailLogActionFilter;
  onActionChange: (value: MailLogActionFilter) => void;
};

export function MailLogFilters({
  search,
  onSearchChange,
  range,
  onRangeChange,
  action,
  onActionChange,
}: MailLogFiltersProps) {
  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
      <div className="flex h-10 w-full items-center gap-2 rounded-input border border-gray-300 bg-white px-3 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] md:min-w-[11.25rem] md:flex-1 md:px-3.5 lg:max-w-[17.5rem] lg:flex-none">
        <Search
          className="size-3.5 shrink-0 text-gray-400 md:size-4"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search customers..."
          aria-label="Search the mail log by customer"
          className="min-w-0 flex-1 bg-transparent text-small text-text outline-none placeholder:text-gray-400 md:text-body"
        />
      </div>

      {/* The two selects share one line on mobile and hug their labels above it. */}
      <div className="flex items-center gap-2 md:contents">
        <MailLogFilterSelect
          label="Date range"
          options={MAIL_LOG_DATE_RANGES}
          value={range}
          onChange={onRangeChange}
          className="flex-1 md:w-[10rem] md:flex-none"
        />

        <MailLogFilterSelect
          label="Request type"
          options={MAIL_LOG_ACTION_FILTERS}
          value={action}
          onChange={onActionChange}
          className="flex-1 md:w-[10rem] md:flex-none"
        />
      </div>
    </div>
  );
}
