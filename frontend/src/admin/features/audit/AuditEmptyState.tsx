import { ScrollText } from 'lucide-react';

/*
 * What the list shows once a query resolves with nothing to render.
 *
 * The copy distinguishes the two ways it happens (Design.md): a genuinely empty
 * trail, versus filters that matched nothing, where the useful next step is
 * clearing them.
 *
 * The unfiltered wording matters more here than on most screens. An empty audit
 * log is not a normal state — the table is written by every admin action — so
 * "no entries yet" would read as reassurance when it is closer to a warning. It
 * says what would put rows here instead.
 */

type AuditEmptyStateProps = {
  isFiltered: boolean;
  onClearFilters: () => void;
};

export function AuditEmptyState({
  isFiltered,
  onClearFilters,
}: AuditEmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <ScrollText className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">
          {isFiltered
            ? 'No entries match these filters'
            : 'No activity recorded yet'}
        </p>
        <p className="max-w-[26.25rem] text-body text-gray-500">
          {isFiltered
            ? 'Try a different category, action, date range, or search term.'
            : 'Entries appear here as soon as anyone signs in or acts on a record.'}
        </p>
      </div>

      {isFiltered ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
