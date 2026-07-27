import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';

import { groupByCategory } from '../../lib/fields';
import type { FieldDefinition } from '../../types/fields';
import { fieldTypeLabel } from '../../types/fields';

/*
 * Add a question to a service form — by picking from the field registry.
 *
 * This is the whole point of the registry: an admin building a form does not
 * author a question, they choose one that has already been registered. So this
 * component offers the live registry, grouped by category and filtered by
 * search, and marks the ones this service already asks.
 *
 * Fields already picked are shown but disabled rather than hidden, so it is
 * obvious the question exists and is already on the form — hiding it would look
 * like it had been deleted from the registry.
 *
 * A field the registry doesn't have yet is registered on the Form fields screen,
 * which the empty state links to. That separation is deliberate: allowing
 * inline authoring here is exactly how per-service drift would creep back in.
 */

type FieldPickerProps = {
  open: boolean;
  fields: FieldDefinition[];
  isLoading: boolean;
  // Keys the service already asks — on any step, since answers land in one flat
  // map per service.
  pickedKeys: string[];
  onPick: (field: FieldDefinition) => void;
  onClose: () => void;
};

export function FieldPicker({
  open,
  fields,
  isLoading,
  pickedKeys,
  onPick,
  onClose,
}: FieldPickerProps) {
  const [search, setSearch] = useState('');

  const picked = useMemo(() => new Set(pickedKeys), [pickedKeys]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = term
      ? fields.filter(
          (field) =>
            field.label.toLowerCase().includes(term) ||
            field.key.toLowerCase().includes(term),
        )
      : fields;

    return groupByCategory(matching);
  }, [fields, search]);

  if (!open) return null;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-primary/30 bg-primary-light/30 p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-600">
          Add a question
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close field picker"
          className="flex size-7 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-white hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search registered fields"
          aria-label="Search registered fields"
          autoFocus
          className="h-input w-full rounded-input border border-gray-300 bg-white pl-9 pr-3 text-body text-text placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary"
        />
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-body text-gray-500">Loading fields…</p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-5 text-center">
          <p className="text-body text-gray-600">
            {search
              ? 'No registered field matches that.'
              : 'No fields registered yet.'}
          </p>
          <a
            href="/admin/fields"
            target="_blank"
            rel="noreferrer"
            className="text-body font-medium text-primary underline-offset-2 hover:underline"
          >
            Register a field on the Form fields screen
          </a>
        </div>
      ) : (
        <div className="flex max-h-[320px] flex-col gap-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.category} className="flex flex-col gap-1.5">
              <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
                {group.category}
              </span>

              <ul className="flex flex-col gap-1.5">
                {group.fields.map((field) => {
                  const isPicked = picked.has(field.key);

                  return (
                    <li key={field.id}>
                      <button
                        type="button"
                        disabled={isPicked}
                        onClick={() => onPick(field)}
                        className={`flex w-full items-center justify-between gap-3 rounded-control border px-3 py-2 text-left transition-colors ${
                          isPicked
                            ? 'cursor-not-allowed border-gray-200 bg-gray-100'
                            : 'border-gray-200 bg-white hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                        }`}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span
                            className={`truncate text-body font-medium ${isPicked ? 'text-gray-500' : 'text-text'}`}
                          >
                            {field.label}
                          </span>
                          <span className="truncate text-caption text-gray-500">
                            {fieldTypeLabel(field.type)} · {field.key}
                          </span>
                        </span>

                        {isPicked ? (
                          <span className="flex shrink-0 items-center gap-1 text-caption font-medium text-gray-500">
                            <Check
                              className="size-4"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            Added
                          </span>
                        ) : (
                          <Plus
                            className="size-4 shrink-0 text-primary"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
