import { AlertTriangle } from 'lucide-react';

/*
 * What an admin screen shows when a fetch fails (Design.md — every screen that
 * fetches owes an error state, and it must be distinguishable from an empty one).
 *
 * It says what failed in plain words and offers a retry that refetches. The
 * status code and the API's error code stay out of the copy — the API returns a
 * code and the wording is ours (AGENTS.md, API Conventions).
 *
 * One component rather than one per screen: the admin area had this shape only on
 * the audit log, and every other screen fell through to its empty state on a
 * failed fetch — a false all-clear. Duplication inside one area is what Design.md
 * asks to extract, so the copy is a prop and the shape lives here.
 *
 * `bare` drops the card frame for a slot that already draws one (a table card, a
 * chart card), so the alert never nests two borders.
 */

type DataErrorStateProps = {
  title: string;
  description: string;
  onRetry: () => void;
  isRetrying?: boolean;
  bare?: boolean;
  className?: string;
};

export function DataErrorState({
  title,
  description,
  onRetry,
  isRetrying = false,
  bare = false,
  className = '',
}: DataErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex w-full flex-col items-center gap-3 px-6 py-14 text-center ${
        bare ? '' : 'rounded-card border border-gray-200 bg-white'
      } ${className}`}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">{title}</p>
        <p className="max-w-[26.25rem] text-body text-gray-500">{description}</p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {isRetrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  );
}
