import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import { RESULT_FIELD_TYPE_OPTIONS, type ResultFieldDefinition } from '../../types/delivery';
import { useAdminResultFields } from './queries';
import { ResultFieldDialog } from './ResultFieldDialog';
import { ResultFieldsList } from './ResultFieldsList';

/*
 * The result registry, as a self-contained panel.
 *
 * Lives beside the request registry on the Form fields screen rather than on a
 * route of its own: they are the two halves of one idea — the questions a
 * service ASKS and the facts it RETURNS — and an admin shaping a service moves
 * between them constantly. Two routes would make that a navigation.
 *
 * A panel rather than a page so the tab switch above it owns the layout and
 * neither half has to know about the other.
 */

export function ResultFieldsPanel() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Open when set: a field to edit, or `'new'` to register one. One flag rather
  // than two, so the two states cannot both be on.
  const [editing, setEditing] = useState<ResultFieldDefinition | 'new' | null>(null);

  const fields = useAdminResultFields({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(type ? { type } : {}),
    includeArchived,
  });

  const rows = useMemo<ResultFieldDefinition[]>(
    () => fields.data?.pages.flatMap((page) => page.fields) ?? [],
    [fields.data],
  );

  const total = fields.data?.pages[0]?.totalResults ?? 0;
  const hasFilter = Boolean(search.trim() || type);

  return (
    <div className="flex w-full flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <p className="text-body text-text-secondary lg:max-w-[640px]">
          The facts a completed service delivers back to the customer. Register a
          fact once here, then add it to a service&apos;s result schema — the
          customer&apos;s page for that service renders whatever it returns.
        </p>

        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex h-input shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-body font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Register result field
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search result fields"
            aria-label="Search result fields"
            className="h-input w-full rounded-input border border-gray-300 bg-white pl-9 pr-3 text-body text-text placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary"
          />
        </div>

        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Filter by value type"
          className="h-input cursor-pointer rounded-input border border-gray-300 bg-white px-3 text-body text-text focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary md:w-[180px]"
        >
          <option value="">All types</option>
          {RESULT_FIELD_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-2 text-body text-text">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
            className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
          />
          Show archived
        </label>
      </div>

      {fields.isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 w-full animate-pulse rounded-card bg-gray-200"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="text-body-lg font-medium text-text">
            {hasFilter ? 'No fields match' : 'No result fields registered yet'}
          </p>
          <p className="max-w-[440px] text-body text-text-secondary">
            {hasFilter
              ? 'Try a different search or clear the type filter.'
              : 'Register what your services hand back — a company name, a registration number, a filed certificate — then add them to a service’s result schema.'}
          </p>
          {!hasFilter && (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="mt-1 flex h-input items-center justify-center gap-2 rounded-control bg-primary px-4 text-body font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Register result field
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
            {total} field{total === 1 ? '' : 's'}
          </p>

          <ResultFieldsList fields={rows} onEdit={setEditing} />

          {fields.hasNextPage && (
            <button
              type="button"
              onClick={() => void fields.fetchNextPage()}
              disabled={fields.isFetchingNextPage}
              className="mx-auto flex h-input items-center justify-center rounded-control border border-gray-300 bg-white px-5 text-body font-medium text-text transition-colors hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {fields.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {editing !== null ? (
        <ResultFieldDialog
          field={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
