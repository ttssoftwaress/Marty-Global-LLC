import { Link } from 'react-router-dom';
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
  /** The region list failed to load — distinct from there being none yet. */
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function RegionPicker({
  regions,
  selected,
  onChange,
  error,
  isLoading,
  isError = false,
  isRetrying = false,
  onRetry,
}: RegionPickerProps) {
  const toggle = (code: string) => {
    onChange(
      selected.includes(code)
        ? selected.filter((value) => value !== code)
        : [...selected, code],
    );
  };

  /*
   * The error renders in every branch, not just the populated one. A service
   * needs a region to be saved, so if the list is still loading or came back
   * empty there is nothing to select and the save is blocked — silently, unless
   * the reason is printed here as well.
   */
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-9 w-24 animate-pulse rounded-pill bg-gray-200"
            />
          ))}
        </div>

        {error ? <p className="text-caption text-error">{error}</p> : null}
      </div>
    );
  }

  /*
   * A failed load, said as one. It has to come before the empty branch below:
   * a failed fetch also leaves the list empty, and the empty copy would send the
   * admin to Admin settings to add jurisdictions that are already there.
   */
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-body text-error">
          The list of locations didn&rsquo;t load, so none can be chosen here yet.
        </p>

        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="flex h-9 items-center justify-center rounded-control border border-primary px-3 text-small font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isRetrying ? 'Retrying…' : 'Try again'}
          </button>
        ) : null}

        {error ? <p className="text-caption text-error">{error}</p> : null}
      </div>
    );
  }

  /*
   * No locations yet. On a fresh database this is the normal first state rather
   * than a failure — nothing seeds the list, an admin adds them — so the copy
   * points at the screen that fixes it instead of describing a fault.
   */
  if (regions.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-body text-gray-500">
          No locations yet. Add the jurisdictions you operate in under{' '}
          <Link
            to="/admin/settings"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Admin settings
          </Link>
          , then choose them here.
        </p>

        {error ? <p className="text-caption text-error">{error}</p> : null}
      </div>
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
