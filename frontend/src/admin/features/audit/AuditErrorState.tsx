import { AlertTriangle } from 'lucide-react';

/*
 * What the screen shows when the trail fails to load (Design.md — every screen
 * that fetches owes an error state, and it must be distinguishable from an empty
 * one).
 *
 * It says what failed in plain words and offers a retry that refetches. The
 * status code and the API's error code stay out of the copy — the API returns a
 * code and the wording is ours (AGENTS.md, API Conventions).
 *
 * Worth being explicit on this screen in particular: a failed load here must
 * never be mistaken for "nothing has happened". That is the difference between a
 * broken page and a false all-clear, so the copy names the failure rather than
 * describing the trail.
 */

type AuditErrorStateProps = {
  onRetry: () => void;
  isRetrying: boolean;
};

export function AuditErrorState({ onRetry, isRetrying }: AuditErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">Couldn't load the audit log</p>
        <p className="max-w-[26.25rem] text-body text-gray-500">
          The entries didn't load, so this is not a record of nothing happening.
          Try again in a moment.
        </p>
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
