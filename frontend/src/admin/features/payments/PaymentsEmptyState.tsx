import { Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
 * The "nothing to show" panel for the ledger and the transfer queue.
 *
 * The design covers neither case, so this fills a state it left out (Design.md
 * — fill in states the design did not cover). It distinguishes an empty filter
 * from an empty dataset, because those need different words and only one of them
 * offers a way out.
 */

type PaymentsEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  onClearFilter?: () => void;
};

export function PaymentsEmptyState({
  icon: Icon = Receipt,
  title,
  description,
  onClearFilter,
}: PaymentsEmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100">
        <Icon className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-body-lg font-semibold text-text">{title}</p>
        <p className="max-w-sm text-small text-gray-500">{description}</p>
      </div>

      {onClearFilter ? (
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Show all quotes
        </button>
      ) : null}
    </div>
  );
}
