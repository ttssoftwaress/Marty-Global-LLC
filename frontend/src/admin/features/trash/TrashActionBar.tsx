import { Loader2, RotateCcw, Trash2, X } from 'lucide-react';

/*
 * The bar above the Trash list once entries are ticked: restore, or destroy for
 * good.
 *
 * Deliberately not `SelectionBar` (the one every other admin list uses). That
 * bar offers one destructive action; this one offers a safe action and an
 * irreversible one side by side, and the two need visibly different weights —
 * Restore is the primary and is what an admin came here for, while "Delete
 * permanently" is outlined in the error colour and is the only control in the
 * whole feature with nothing behind it.
 *
 * "Delete permanently" is admin-only and simply absent otherwise, rather than
 * disabled: a staff member with `trash` can restore all day, and a greyed-out
 * button would invite a click that can only ever be refused.
 *
 * `role="status"` rather than `alert`: appearing is not an emergency, but the
 * count changing as boxes are ticked is worth announcing, and `alert` would
 * interrupt on every tick.
 */

type TrashActionBarProps = {
  count: number;
  onRestore: () => void;
  onPurge?: () => void;
  onClear: () => void;
  isRestoring: boolean;
  isPurging: boolean;
};

export function TrashActionBar({
  count,
  onRestore,
  onPurge,
  onClear,
  isRestoring,
  isPurging,
}: TrashActionBarProps) {
  if (count === 0) return null;

  const busy = isRestoring || isPurging;

  return (
    <div
      role="status"
      className="flex w-full animate-fade-in flex-col gap-3 rounded-card border border-primary/30 bg-primary-light px-4 py-3 motion-reduce:animate-none sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body font-semibold text-text">
        {count} record{count === 1 ? '' : 's'} selected
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className="flex h-10 items-center gap-2 rounded-control bg-primary px-4 text-body font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {isRestoring ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {isRestoring ? 'Restoring…' : 'Restore'}
        </button>

        {onPurge ? (
          <button
            type="button"
            onClick={onPurge}
            disabled={busy}
            className="flex h-10 items-center gap-2 rounded-control border border-error bg-white px-4 text-body font-semibold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isPurging ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            {isPurging ? 'Deleting…' : 'Delete permanently'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClear}
          className="flex h-10 items-center gap-1.5 rounded-control px-3 text-body font-medium text-gray-600 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Clear
        </button>
      </div>
    </div>
  );
}
