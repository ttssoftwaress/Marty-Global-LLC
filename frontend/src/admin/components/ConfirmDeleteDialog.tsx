import { Loader2, Trash2 } from 'lucide-react';

import { FormDialog } from './FormDialog';

/*
 * The confirmation between a bulk delete and the delete.
 *
 * A modal rather than the inline yes/no `RowActions` uses, and the difference is
 * the point: one row is a decision an admin can see the whole of in the row
 * itself, while a selection of twenty is not. This is where the count, the reach,
 * and the way back are stated before anything happens.
 *
 * What it says, and why each part is there:
 *
 *   - **The count and the noun.** "Delete 12 orders?" — never a bare "Are you
 *     sure?", which asks about nothing.
 *   - **The way back.** The retention window, in plain words. This is the whole
 *     reason the action is safe to offer at all, and burying it would leave an
 *     admin treating a reversible click as an irreversible one.
 *   - **The error, in place.** A refusal comes back as a sentence from the
 *     backend — the last active admin, a service on a customer's order — and it
 *     is rendered here, beside the button that caused it, rather than as a toast
 *     that outlives the dialog. `role="alert"`, so it is announced.
 *
 * The dialog stays open on a refusal. Closing it would hide the reason at the
 * moment it became relevant.
 */

type ConfirmDeleteDialogProps = {
  open: boolean;
  count: number;
  // "order" / "orders". The dialog picks between them by count.
  singularNoun: string;
  pluralNoun: string;
  // How many days the delete stays reversible for. Null while the setting loads,
  // which softens the sentence rather than printing a number that might be wrong.
  retentionDays: number | null;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDeleteDialog({
  open,
  count,
  singularNoun,
  pluralNoun,
  retentionDays,
  isDeleting,
  error,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const noun = count === 1 ? singularNoun : pluralNoun;
  const title = `Delete ${count} ${noun}?`;

  return (
    <FormDialog
      open={open}
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex h-11 items-center justify-center rounded-control border border-gray-200 px-5 text-body font-semibold text-text transition-colors hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex h-11 items-center justify-center gap-2 rounded-control bg-error px-5 text-body font-semibold text-white transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            {isDeleting ? 'Deleting…' : `Delete ${noun}`}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text">
          {count === 1
            ? `This ${singularNoun} will be removed from every screen it appears on, along with anything attached to it.`
            : `These ${pluralNoun} will be removed from every screen they appear on, along with anything attached to them.`}
        </p>

        <p className="text-body text-gray-500">
          {retentionDays === null
            ? 'You can restore them from Trash while they are still there.'
            : `Nothing is destroyed now — you can restore ${
                count === 1 ? 'it' : 'them'
              } from Trash for the next ${retentionDays} day${
                retentionDays === 1 ? '' : 's'
              }.`}
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-input border border-error/30 bg-error/5 px-3 py-2 text-body text-error"
          >
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
