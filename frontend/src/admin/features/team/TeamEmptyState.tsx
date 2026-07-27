import { UserCheck } from 'lucide-react';

/*
 * What the list shows once a query resolves with nothing to render — a state the
 * links do not cover, so it follows the app's own empty-state shape (Design.md,
 * filling in states the design did not cover).
 *
 * The copy distinguishes the two ways it happens: a genuinely empty team, versus
 * a search or filter that matched nothing, where the useful next step is
 * clearing them.
 */

type TeamEmptyStateProps = {
  isFiltered: boolean;
  onClearFilters: () => void;
};

export function TeamEmptyState({
  isFiltered,
  onClearFilters,
}: TeamEmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <UserCheck className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">
          {isFiltered ? 'No team members match this search' : 'No team members yet'}
        </p>
        <p className="max-w-[380px] text-body text-gray-500">
          {isFiltered
            ? 'Try a different status, role, or search term.'
            : 'Add a staff member to give them a login for the admin portal.'}
        </p>
      </div>

      {isFiltered ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
