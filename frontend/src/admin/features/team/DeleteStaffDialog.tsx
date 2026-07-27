import { AlertTriangle } from 'lucide-react';

import { AddStaffDialog } from './AddStaffDialog';

/*
 * The confirmation an admin passes through before a staff account is deleted.
 *
 * Deleting a login ends a colleague's access to every admin area, and there is
 * no undo through the portal, so it is confirmed rather than fired from the row
 * directly. The member's name and email are printed so the admin can see they
 * are about to remove the account they meant to — a row action three columns
 * from a name is easy to misfire.
 *
 * The copy says what actually happens: the backend soft-deletes the record and
 * drops the member's sessions, so their work history stays attributed while the
 * account itself stops working. Promising an irreversible wipe would be wrong,
 * and promising it is reversible would be worse — an admin cannot restore it
 * from here.
 *
 * It reuses the team dialog shell so the sheet/modal behaviour, the focus trap,
 * and the Escape handling are the same as the add-staff form's.
 */

/*
 * Only the two fields printed, rather than a whole row or detail record — both
 * the list and the edit screen open this, and they hold different shapes of the
 * same member. A null member is what keeps it closed.
 */
type DeleteStaffDialogProps = {
  member: { name: string; email: string } | null;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteStaffDialog({
  member,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteStaffDialogProps) {
  return (
    <AddStaffDialog
      open={member !== null}
      title="Delete staff account"
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
            {isDeleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      }
    >
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
            <AlertTriangle className="size-5" strokeWidth={2} aria-hidden="true" />
          </span>

          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-body font-semibold text-text">
              {member?.name}
            </p>
            <p className="truncate text-small text-gray-500">{member?.email}</p>
          </div>
        </div>

        <p className="text-body text-text-secondary">
          This account will be removed from the team and signed out everywhere.
          They will no longer be able to sign in or act on any record. Work they
          have already handled stays on the record.
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
    </AddStaffDialog>
  );
}
