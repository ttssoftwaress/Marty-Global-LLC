import { BookOpen, Plus } from 'lucide-react';

import { EmptyState } from '../../components/EmptyState';

/*
 * What the catalog shows before any service exists. The design draws a populated
 * table only, so this state is filled in per Design.md (states the design didn't
 * cover) — and it matters here more than on most screens, because a catalog with
 * no services is what a fresh install actually looks like.
 *
 * The action is the same one the header offers, so the empty screen is not a
 * dead end.
 */

type CatalogEmptyStateProps = {
  onAddService: () => void;
};

export function CatalogEmptyState({ onAddService }: CatalogEmptyStateProps) {
  return (
    <EmptyState
      icon={BookOpen}
      title="No services yet"
      description="Add a service to define what it includes, where it’s offered, and how it’s priced. Customers can order it as soon as it’s active."
      action={{
        label: 'Add service',
        onClick: onAddService,
        variant: 'primary',
        icon: Plus,
      }}
    />
  );
}
