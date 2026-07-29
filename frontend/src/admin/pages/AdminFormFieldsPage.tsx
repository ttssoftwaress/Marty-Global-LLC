import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import { AdminLayout } from '../components/AdminLayout';
import { DataErrorState } from '../components/DataErrorState';
import { FieldFormDialog } from '../features/fields/FieldFormDialog';
import { FieldsList } from '../features/fields/FieldsList';
import {
  useAdminFields,
  useCreateField,
  useDeleteField,
  useUpdateField,
} from '../features/fields/queries';
import { ResultFieldsPanel } from '../features/result-fields/ResultFieldsPanel';
import { useAdminShell } from '../hooks/useAdminShell';
import { ApiError } from '@/services/api';
import type { FieldDefinition } from '../types/fields';
import { FIELD_TYPE_OPTIONS } from '../types/fields';

/*
 * Form fields — the field registry.
 *
 * This screen is the answer to "who decides what a question is". An admin
 * registers a field once here, and every service form is then built by PICKING
 * from this list rather than re-authoring the question. Two things follow, and
 * they are the reason the screen exists:
 *
 *   - Answer keys are a closed set. Every key stored in an order's answers is a
 *     registered key, so the database never accumulates `companyName` /
 *     `company_name` / `entityName` for what is one question.
 *   - The customer's merged master form is exact. Two services picking the same
 *     field are asking the same question by construction, so the order flow asks
 *     it once — no spelling match, no guessing.
 *
 * The "Used by" column is deliberately prominent: it is the blast radius of an
 * edit. Re-labelling a field used by four services re-labels it in all four.
 *
 * This screen has no Figma link — it is built to the written brief, in the same
 * card and table language as the designed admin screens, and logged as a
 * deviation.
 */

/*
 * The screen carries both registries as tabs. They are the two halves of one
 * idea — the questions a service ASKS and the facts it RETURNS — and an admin
 * shaping a service moves between them constantly, so two routes would turn that
 * into a navigation. The heading and the tab strip are shared; each panel owns
 * its own filters, list, and dialog.
 */
type RegistryTab = 'request' | 'result';

export function AdminFormFieldsPage() {
  const { user, onLogout } = useAdminShell();
  const [tab, setTab] = useState<RegistryTab>('request');

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // The dialog is open when `editing` is set: a field to edit, or `'new'` to
  // register one. One flag rather than two, so the two states cannot both be on.
  const [editing, setEditing] = useState<FieldDefinition | 'new' | null>(null);

  const fields = useAdminFields({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(type ? { type } : {}),
    includeArchived,
  });

  const createField = useCreateField();
  const updateField = useUpdateField();
  const deleteField = useDeleteField();

  // Which row is mid-delete, so only that row's button says "Deleting…".
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rows = useMemo<FieldDefinition[]>(
    () => fields.data?.pages.flatMap((page) => page.fields) ?? [],
    [fields.data],
  );

  const total = fields.data?.pages[0]?.totalResults ?? 0;

  const openCreate = () => {
    createField.reset();
    updateField.reset();
    setEditing('new');
  };

  const openEdit = (field: FieldDefinition) => {
    createField.reset();
    updateField.reset();
    setEditing(field);
  };

  const close = () => setEditing(null);

  /*
   * Delete only reaches here for a row the API marked `canDelete`, and the
   * endpoint re-checks it — including the stored answers the list's cheap check
   * cannot see. A refusal names the reason and points at archiving instead, so
   * it is surfaced rather than swallowed.
   */
  const onDelete = (field: FieldDefinition) => {
    if (deleteField.isPending) return;
    deleteField.reset();
    setDeletingId(field.id);
    deleteField.mutate(field.id, { onSettled: () => setDeletingId(null) });
  };

  const deleteError = deleteField.isError
    ? deleteField.error instanceof ApiError
      ? deleteField.error.message
      : 'Something went wrong deleting this field. Please try again.'
    : null;

  const editingField = editing === 'new' ? null : editing;
  const isSaving = createField.isPending || updateField.isPending;

  const saveError = (() => {
    const error = createField.error ?? updateField.error;
    if (!error) return null;
    return error instanceof ApiError
      ? error.message
      : 'Something went wrong saving this field. Please try again.';
  })();

  const onSubmit = (
    payload:
      | { mode: 'create'; body: Parameters<typeof createField.mutate>[0] }
      | { mode: 'update'; body: Parameters<typeof updateField.mutate>[0]['payload'] },
  ) => {
    if (payload.mode === 'create') {
      createField.mutate(payload.body, { onSuccess: close });
      return;
    }

    if (!editingField) return;
    updateField.mutate(
      { fieldId: editingField.id, payload: payload.body },
      { onSuccess: close },
    );
  };

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 md:gap-6">
          <header className="flex flex-col gap-4">
            <h1 className="text-h4 font-semibold text-text lg:text-h3">
              Form fields
            </h1>

            <div
              role="tablist"
              aria-label="Registry"
              className="flex w-fit items-center gap-1 rounded-input bg-gray-100 p-1"
            >
              {(
                [
                  { value: 'request', label: 'Request fields' },
                  { value: 'result', label: 'Result fields' },
                ] as const
              ).map((option) => {
                const active = option.value === tab;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(option.value)}
                    className={`whitespace-nowrap rounded-[0.5rem] px-4 py-2 text-[0.8125rem] font-semibold transition-colors ${
                      active
                        ? 'bg-white text-text shadow-sm-elevation'
                        : 'text-gray-500 hover:text-text'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </header>

          {tab === 'result' ? (
            <ResultFieldsPanel />
          ) : (
            <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <p className="text-body text-text-secondary lg:max-w-[40rem]">
              The questions service forms are built from. Register a field once
              here, then add it to any service — a field shared by two services
              is asked once when a customer orders both.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="flex h-input shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-body font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Register field
            </button>
          </div>

          {/* Filters. Search and type narrow the list server-side; archived is a
              toggle rather than a filter value because it is the only one that
              adds rows rather than removing them. */}
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
                placeholder="Search fields"
                aria-label="Search fields"
                className="h-input w-full rounded-input border border-gray-300 bg-white pl-9 pr-3 text-body text-text placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary"
              />
            </div>

            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Filter by answer type"
              className="h-input cursor-pointer rounded-input border border-gray-300 bg-white px-3 text-body text-text focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary md:w-[11.25rem]"
            >
              <option value="">All types</option>
              {FIELD_TYPE_OPTIONS.map((option) => (
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
          ) : fields.isError ? (
            /* A failed fetch is not an empty registry: "No fields registered
               yet" over a load error reads as data loss rather than a request
               that failed, and points the admin at the wrong problem. */
            <DataErrorState
              title="We couldn’t load the field registry"
              description="Something went wrong fetching the registered fields. Try again."
              onRetry={() => void fields.refetch()}
              isRetrying={fields.isFetching}
            />
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-gray-300 px-6 py-12 text-center">
              <p className="text-body-lg font-medium text-text">
                {search || type ? 'No fields match' : 'No fields registered yet'}
              </p>
              <p className="max-w-[26.25rem] text-body text-text-secondary">
                {search || type
                  ? 'Try a different search or clear the type filter.'
                  : 'Register the questions your services ask — a company name, a passport upload — then build each service form by picking from them.'}
              </p>
              {!search && !type && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-1 flex h-input items-center justify-center gap-2 rounded-control bg-primary px-4 text-body font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                  Register field
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
                {total} field{total === 1 ? '' : 's'}
              </p>

              {deleteError ? (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  {deleteError}
                </p>
              ) : null}

              <FieldsList
                fields={rows}
                onEdit={openEdit}
                onDelete={onDelete}
                deletingId={deletingId}
              />

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
            </>
          )}
        </div>
      </div>

      {/* The request registry's dialog. Gated on the tab so switching away
       * closes it rather than leaving it open over the other panel. */}
      <FieldFormDialog
        open={tab === 'request' && editing !== null}
        field={editingField}
        isSaving={isSaving}
        error={saveError}
        onClose={close}
        onSubmit={onSubmit}
      />
    </AdminLayout>
  );
}
