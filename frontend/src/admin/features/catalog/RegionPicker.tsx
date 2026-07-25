import { Check } from 'lucide-react';

import type { ServiceRegion } from '../../types/catalog';

/*
 * Where a service is offered — the write side of the table's "Regions supported"
 * column.
 *
 * A toggle-chip grid rather than a multi-select, because the chosen regions are
 * what the row renders as chips: the control looks like its result. The set
 * comes from the API, so a new jurisdiction appears here without a deploy.
 *
 * Each chip is a real checkbox with the input visually hidden, so the group is
 * keyboard-navigable and announced as checked/unchecked rather than being a div
 * that only looks selected.
 */

type RegionPickerProps = {
  regions: ServiceRegion[];
  selected: string[];
  onChange: (codes: string[]) => void;
  error?: string;
  isLoading?: boolean;
};

export function RegionPicker({
  regions,
  selected,
  onChange,
  error,
  isLoading,
}: RegionPickerProps) {
  const toggle = (code: string) => {
    onChange(
      selected.includes(code)
        ? selected.filter((value) => value !== code)
        : [...selected, code],
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-9 w-24 animate-pulse rounded-pill bg-gray-200"
          />
        ))}
      </div>
    );
  }

  if (regions.length === 0) {
    return (
      <p className="text-body text-gray-500">
        No regions are configured yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="group"
        aria-label="Regions supported"
        className="flex flex-wrap gap-2"
      >
        {regions.map((region) => {
          const isSelected = selected.includes(region.code);

          return (
            <label
              key={region.code}
              className={`flex cursor-pointer items-center gap-1.5 rounded-pill border px-3 py-2 text-body transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
                isSelected
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(region.code)}
                className="sr-only"
              />
              {isSelected ? (
                <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <span aria-hidden="true">{region.flag}</span>
              )}
              <span className="font-medium">{region.label}</span>
            </label>
          );
        })}
      </div>

      {error ? <p className="text-caption text-error">{error}</p> : null}
    </div>
  );
}
