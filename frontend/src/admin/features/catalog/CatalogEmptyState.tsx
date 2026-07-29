import { BookOpen, Plus } from 'lucide-react';

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
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100">
        <BookOpen
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>

      <div className="flex flex-col gap-1">
        <h3 className="text-body-lg font-semibold text-text">
          No services yet
        </h3>
        <p className="max-w-[26.25rem] text-body text-gray-500">
          Add a service to define what it includes, where it&rsquo;s offered, and
          how it&rsquo;s priced. Customers can order it as soon as it&rsquo;s
          active.
        </p>
      </div>

      <button
        type="button"
        onClick={onAddService}
        className="mt-2 flex h-10 items-center gap-2 rounded-control bg-primary px-4 text-body font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Add service
      </button>
    </div>
  );
}
