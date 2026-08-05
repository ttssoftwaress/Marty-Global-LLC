import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

import { FormDialog } from '../../components/FormDialog';

/*
 * The confirmation in front of the one action in this feature with nothing
 * behind it.
 *
 * Deliberately harder to get through than `ConfirmDeleteDialog`, which guards a
 * delete that can be undone all week. Two differences, and both are the point:
 *
 *   · The copy leads with what is lost, not with what is selected. "This cannot
 *     be undone" is the whole reason the dialog exists.
 *   · It names the related records the purge takes with it. A trash entry can
 *     stand for one row or for a customer and everything hanging off them, and
 *     that number is the last chance anybody has to notice.
 *
 * What it does NOT do is add a type-to-confirm box. The action is already behind
 * an administrator's role, a tick, a bar, and this dialog, and a system that asks
 * people to type words trains them to type words.
 */

type ConfirmPurgeDialogProps = {
  open: boolean;
  count: number;
  // Rows that would go with the selected entries — the cascade totals summed.
  relatedCount: number;
  isPurging: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmPurgeDialog({
  open,
  count,
  relatedCount,
  isPurging,
  error,
  onConfirm,
  onClose,
}: ConfirmPurgeDialogProps) {
  return (
    <FormDialog
      open={open}
      title={`Permanently delete ${count} record${count === 1 ? '' : 's'}?`}
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPurging}
            className="flex h-11 items-center justify-center rounded-control border border-gray-200 px-5 text-body font-semibold text-text transition-colors hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isPurging}
            className="flex h-11 items-center justify-center gap-2 rounded-control bg-error px-5 text-body font-semibold text-white transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isPurging ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            {isPurging ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 rounded-card border border-error/30 bg-error/5 p-3.5 text-body leading-6 text-error">
          <AlertTriangle
            className="mt-1 size-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>
            This cannot be undone. Once deleted, only the audit log will record
            that {count === 1 ? 'this record' : 'these records'} ever existed.
          </span>
        </p>

        {relatedCount > 0 ? (
          <p className="text-body text-text">
            {relatedCount} related record{relatedCount === 1 ? '' : 's'} will be
            destroyed alongside {count === 1 ? 'it' : 'them'}.
          </p>
        ) : null}

        <p className="text-body text-gray-500">
          A few records are kept even here — a staff account that owns customer
          filings, or a bank account money was collected through. Those stay in
          the Trash with the reason shown on the row.
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
