import { AlertTriangle } from 'lucide-react';

import { FormDialog } from '../../components/FormDialog';

/*
 * The confirmation before a job role is deleted.
 *
 * A role is only deletable when nobody holds it — the backend refuses otherwise
 * and the screen hides the action — so this is not warning about losing anyone's
 * access. What it warns about is that the definition itself is gone: the grid
 * somebody assembled is not recoverable, and the next person needing that shape
 * of access rebuilds it by hand.
 *
 * Reuses the shared admin dialog shell, so the sheet/modal behaviour, the focus
 * trap, and Escape are the same as every other confirmation here.
 */

type DeleteRoleDialogProps = {
  role: { label: string } | null;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteRoleDialog({
  role,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteRoleDialogProps) {
  return (
    <FormDialog
      open={role !== null}
      title="Delete role"
      size="sm"
      onClose={isDeleting ? () => {} : onCancel}
      footer={
        <div className="flex items-center justify-end gap-3 md:gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex h-input items-center justify-center rounded-control border border-gray-300 bg-white px-5 text-button text-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex h-input min-w-0 items-center justify-center rounded-control bg-error px-5 text-button text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          >
            {isDeleting ? 'Deleting…' : 'Delete role'}
          </button>
        </div>
      }
    >
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
            <AlertTriangle className="size-5" strokeWidth={2} aria-hidden="true" />
          </span>

          <p className="min-w-0 text-body font-semibold text-text">{role?.label}</p>
        </div>

        <p className="text-body text-text-secondary">
          Nobody holds this role, so no one loses access. The permissions set on
          it are deleted with it and cannot be restored.
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
          >
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
