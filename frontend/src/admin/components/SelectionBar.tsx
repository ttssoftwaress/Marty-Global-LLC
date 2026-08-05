import { Loader2, Trash2, X } from 'lucide-react';

/*
 * The bar that appears above a list once rows are ticked: what is selected, the
 * destructive action, and a way out.
 *
 * It replaces nothing and pushes nothing off screen — it sits between the
 * filters and the list, so the rows stay visible while the decision is made. A
 * bar that covered them would be asking an admin to confirm a delete they can no
 * longer see.
 *
 * `role="status"` rather than `alert`: appearing is not an emergency, but the
 * count changing as boxes are ticked is worth announcing, and `alert` would
 * interrupt on every tick.
 *
 * The delete button opens a confirmation (`ConfirmDeleteDialog`) rather than
 * acting — a bulk destructive action is the one place an accidental click is
 * most expensive, and the dialog is where the reach of the delete is spelled
 * out.
 */

type SelectionBarProps = {
  count: number;
  // The plural noun for what is selected — "orders", "customers". Rendered as
  // "3 orders selected", so it is the caller's job to have it agree with the
  // list it sits over.
  noun: string;
  singularNoun: string;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
  // Shown in place of the button when the signed-in member may not delete here.
  // A disabled button would invite a click that can only ever be refused.
  disabledReason?: string;
};

export function SelectionBar({
  count,
  noun,
  singularNoun,
  onDelete,
  onClear,
  isDeleting = false,
  disabledReason,
}: SelectionBarProps) {
  if (count === 0) return null;

  const label = `${count} ${count === 1 ? singularNoun : noun} selected`;

  return (
    <div
      role="status"
      className="flex w-full animate-fade-in flex-col gap-3 rounded-card border border-primary/30 bg-primary-light px-4 py-3 motion-reduce:animate-none sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body font-semibold text-text">{label}</p>

      <div className="flex items-center gap-2">
        {disabledReason ? (
          <p className="text-small text-gray-600">{disabledReason}</p>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="flex h-10 items-center gap-2 rounded-control border border-error bg-white px-4 text-body font-semibold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        )}

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
