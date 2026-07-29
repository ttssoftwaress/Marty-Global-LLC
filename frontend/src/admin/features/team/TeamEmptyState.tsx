import { UserCheck } from 'lucide-react';

import { EmptyState } from '../../components/EmptyState';

/*
 * What the list shows once a query resolves with nothing to render — a state the
 * links do not cover, so it uses the shared admin empty state (Design.md,
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
    <EmptyState
      icon={UserCheck}
      title={
        isFiltered ? 'No team members match this search' : 'No team members yet'
      }
      description={
        isFiltered
          ? 'Try a different status, role, or search term.'
          : 'Add a staff member to give them a login for the admin portal.'
      }
      action={
        isFiltered
          ? { label: 'Clear filters', onClick: onClearFilters }
          : undefined
      }
    />
  );
}
