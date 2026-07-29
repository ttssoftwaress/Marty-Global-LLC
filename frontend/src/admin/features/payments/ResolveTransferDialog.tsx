import { useEffect, useState } from 'react';

import { ApiError } from '@/services/api';
import { FormDialog } from '../../components/FormDialog';
import { formatOrderDate } from '../../lib/format';
import type { UnmatchedTransferRow } from '../../types/payments';
import { shortHash } from './UnmatchedTransferTable';

/*
 * Closing out a transfer nobody can be billed for: the reviewer records what the
 * money turned out to be, and the row leaves the open queue.
 *
 * The dialog deliberately offers no way to attach the transfer to an invoice.
 * That would be crediting a payment from a figure a human typed, which AGENTS.md
 * forbids outright — the amount is always resolved from the quote, and money
 * genuinely owed is collected the one way it ever is: the customer pays, and the
 * poller credits the transfer it matches. This is an annotation, and the copy
 * says so.
 *
 * The transfer's own details are repeated inside the panel rather than trusted to
 * the row behind it: the reviewer is writing a permanent note against a specific
 * hash, and on mobile the sheet covers the row entirely.
 *
 * It renders inside the shared admin dialog shell (`components/FormDialog`),
 * which owns the bottom-sheet-on-mobile / centred-modal-from-`md` presentation
 * and, through `useOverlay`, Escape, the body scroll lock, focus moving in on
 * open and back on close, and the Tab trap while open.
 */

// Matches the backend's `resolveUnmatchedSchema`, so the field cannot submit a
// value the API will reject.
const NOTE_MAX = 280;

type ResolveTransferDialogProps = {
  transfer: UnmatchedTransferRow | null;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (note: string) => void;
  onClose: () => void;
};

export function ResolveTransferDialog({
  transfer,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: ResolveTransferDialogProps) {
  const [note, setNote] = useState('');

  const open = transfer !== null;

  // A fresh note per transfer: carrying the last one over would risk filing the
  // wrong explanation against a permanent record.
  useEffect(() => {
    if (open) setNote('');
  }, [open, transfer?.id]);

  if (!transfer) return null;

  const trimmed = note.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  // A 409 means another reviewer got there first — worth saying plainly, because
  // the fix is to close the dialog and re-read the queue, not to retry.
  const message =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not reconcile this transfer. Try again.'
        : null;

  return (
    <FormDialog
      open={open}
      title="Reconcile transfer"
      description="Record what this payment turned out to be. This does not credit an invoice — it closes the transfer out of the open queue."
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 flex-1 items-center justify-center rounded-control border border-gray-200 text-body font-semibold text-text transition-colors hover:bg-gray-50 md:flex-none md:px-5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(trimmed)}
            disabled={!canSubmit}
            className="flex h-11 flex-1 items-center justify-center rounded-control bg-primary px-5 text-body font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
          >
            {isSubmitting ? 'Saving…' : 'Mark reconciled'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2 rounded-card bg-gray-50 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Amount</dt>
            <dd className="text-body font-semibold text-text">
              {transfer.amountDisplay} USDT
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-caption text-gray-500">Transaction</dt>
            <dd
              className="min-w-0 truncate font-mono text-small text-text-secondary"
              title={transfer.transactionHash}
            >
              {shortHash(transfer.transactionHash)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-caption text-gray-500">From</dt>
            <dd
              className="min-w-0 truncate font-mono text-small text-text-secondary"
              title={transfer.fromAddress}
            >
              {shortHash(transfer.fromAddress, 8, 6)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Landed</dt>
            <dd className="text-small text-text-secondary">
              {formatOrderDate(transfer.blockAt)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="resolution-note"
            className="text-small font-medium text-text"
          >
            What was it?
          </label>
          <textarea
            id="resolution-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Test transfer from our own wallet — no customer action needed"
            className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caption text-gray-500">
            Kept on the audit trail with your name. {NOTE_MAX - note.length}{' '}
            characters left.
          </p>
        </div>

        {message ? (
          <p role="alert" className="text-small text-error">
            {message}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
