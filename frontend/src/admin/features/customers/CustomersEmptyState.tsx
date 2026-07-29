import { Users } from 'lucide-react';

import { EmptyState } from '../../components/EmptyState';

/*
 * What the list shows once a query resolves with nothing to render — a state the
 * links do not cover, so it uses the shared admin empty state (Design.md,
 * filling in states the design did not cover).
 *
 * The copy distinguishes the two ways it happens: a genuinely empty customer
 * base, versus a search or filter that matched nothing, where the useful next
 * step is clearing them.
 */

type CustomersEmptyStateProps = {
  isFiltered: boolean;
  onClearFilters: () => void;
};

export function CustomersEmptyState({
  isFiltered,
  onClearFilters,
}: CustomersEmptyStateProps) {
  return (
    <EmptyState
      icon={Users}
      title={
        isFiltered ? 'No customers match this search' : 'No customers yet'
      }
      description={
        isFiltered
          ? 'Try a different segment, region, or search term.'
          : 'Customer accounts will appear here as people sign up.'
      }
      action={
        isFiltered
          ? { label: 'Clear filters', onClick: onClearFilters }
          : undefined
      }
    />
  );
}
