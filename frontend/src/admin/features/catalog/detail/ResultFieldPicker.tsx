import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  resultFieldTypeLabel,
  type ResultFieldDefinition,
} from '../../../types/delivery';

/*
 * Add a delivered fact to a service — by picking from the result registry.
 *
 * The mirror of `FieldPicker`, and it follows the same rules for the same
 * reasons: facts already picked are shown but disabled rather than hidden (so it
 * is obvious the fact exists and is already returned), and a fact the registry
 * doesn't have yet is registered on the Form fields screen rather than inline.
 * Allowing inline authoring here is exactly how per-service drift would creep
 * back in.
 */

type ResultFieldPickerProps = {
  open: boolean;
  fields: ResultFieldDefinition[];
  isLoading: boolean;
  pickedKeys: string[];
  onPick: (field: ResultFieldDefinition) => void;
  onClose: () => void;
};

const UNCATEGORIZED = 'Other';

function groupByCategory(fields: ResultFieldDefinition[]) {
  const groups = new Map<string, ResultFieldDefinition[]>();

  for (const field of fields) {
    const key = field.category?.trim() || UNCATEGORIZED;
    groups.set(key, [...(groups.get(key) ?? []), field]);
  }

  return [...groups.entries()]
    .map(([category, items]) => ({ category, fields: items }))
    .sort((a, b) => {
      if (a.category === UNCATEGORIZED) return 1;
      if (b.category === UNCATEGORIZED) return -1;
      return a.category.localeCompare(b.category);
    });
}

export function ResultFieldPicker({
  open,
  fields,
  isLoading,
  pickedKeys,
  onPick,
  onClose,
}: ResultFieldPickerProps) {
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
          Add a delivered fact
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the picker"
          className="flex size-7 items-center justify-center rounded text-gray-500 transition-colors hover:text-text"
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
          placeholder="Search result fields"
          aria-label="Search result fields"
          className="h-input w-full rounded-input border border-gray-300 bg-white pl-9 pr-3 text-body text-text placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-input bg-gray-200" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <p className="text-body text-gray-600">
            {search ? 'No result fields match.' : 'The result registry is empty.'}
          </p>
          <Link
            to="/admin/fields"
            className="text-body font-medium text-primary hover:underline"
          >
            Register one on the Form fields screen
          </Link>
        </div>
      ) : (
        <div className="flex max-h-[20rem] flex-col gap-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.category} className="flex flex-col gap-1.5">
              <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
                {group.category}
              </p>

              {group.fields.map((field) => {
                const already = picked.has(field.key);

                return (
                  <button
                    key={field.id}
                    type="button"
                    disabled={already}
                    onClick={() => onPick(field)}
                    className={`flex items-center gap-3 rounded-input border bg-white px-3 py-2.5 text-left transition-colors ${
                      already
                        ? 'cursor-not-allowed border-gray-200 opacity-60'
                        : 'border-gray-200 hover:border-primary hover:bg-primary-light'
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-medium text-text">
                        {field.label}
                      </span>
                      <span className="truncate text-caption text-gray-500">
                        {resultFieldTypeLabel(field.type)} · {field.key}
                      </span>
                    </span>

                    {already ? (
                      <Check className="size-4 shrink-0 text-gray-400" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Plus className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
