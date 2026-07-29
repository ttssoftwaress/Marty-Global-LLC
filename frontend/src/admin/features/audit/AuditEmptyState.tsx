import { ScrollText } from 'lucide-react';

import { EmptyState } from '../../components/EmptyState';

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
    <EmptyState
      icon={ScrollText}
      title={
        isFiltered ? 'No entries match these filters' : 'No activity recorded yet'
      }
      description={
        isFiltered
          ? 'Try a different category, action, date range, or search term.'
          : 'Entries appear here as soon as anyone signs in or acts on a record.'
      }
      action={
        isFiltered
          ? { label: 'Clear filters', onClick: onClearFilters }
          : undefined
      }
    />
  );
}
