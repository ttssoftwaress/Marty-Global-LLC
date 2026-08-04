import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

import { ApiError } from '@/services/api';
import { FormDialog } from '../../components/FormDialog';
import type { AdminCustomerDetail } from '../../types/customer-detail';

/*
 * Suspending a customer's account, and restoring it.
 *
 * Two dialogs rather than one with a flag: they warn about opposite things. A
 * suspension is the destructive direction — it signs the customer out of every
 * device and refuses the next sign-in, and the person clicking it needs to know
 * that before they do, not after. Restoring is a single confirmed sentence.
 *
 * The note is optional and staff-only. It is never shown to the customer — the
 * sign-in refusal says nothing about why — so its whole audience is the next
 * member to open this record, which is exactly what the placeholder asks for.
 *
 * Both reuse the shared admin dialog shell, so the sheet/modal behaviour, the
 * focus trap, and Escape match every other confirmation here (Design.md).
 */

// Matches the backend's `banCustomerSchema`, so the field cannot submit a value
// the API will then reject.
const REASON_MAX = 200;

function errorMessage(error: unknown, fallback: string): string | null {
  if (error instanceof ApiError) return error.message;
  return error ? fallback : null;
}

type SuspendCustomerDialogProps = {
  customer: AdminCustomerDetail | null;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (reason: string) => void;
  onClose: () => void;
};

export function SuspendCustomerDialog({
  customer,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: SuspendCustomerDialogProps) {
  const [reason, setReason] = useState('');

  const open = customer !== null;

  // Fresh field per opening: a note typed for an account the admin then backed
  // out of must not be carried onto the next one.
  useEffect(() => {
    if (open) setReason('');
  }, [open, customer?.id]);

  if (!customer) return null;

  const message = errorMessage(
    error,
    'Could not suspend this account. Try again.',
  );

  return (
    <FormDialog
      open={open}
      title="Suspend account"
      description={`${customer.name} will be signed out everywhere and won't be able to sign in again until an admin restores access.`}
      size="sm"
      onClose={isSubmitting ? () => {} : onClose}
      footer={
        <div className="flex gap-3 md:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-11 flex-1 items-center justify-center rounded-control border border-gray-200 text-body font-semibold text-text transition-colors hover:bg-gray-50 disabled:opacity-50 md:flex-none md:px-5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason)}
            disabled={isSubmitting}
            className="flex h-11 flex-1 items-center justify-center rounded-control bg-error px-5 text-body font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
          >
            {isSubmitting ? 'Suspending…' : 'Suspend account'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2 rounded-card bg-gray-50 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Customer</dt>
            <dd className="min-w-0 truncate text-body font-semibold text-text">
              {customer.name}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Email</dt>
            <dd className="min-w-0 truncate text-small text-text-secondary">
              {customer.email}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="suspend-reason"
            className="text-small font-medium text-text"
          >
            Reason
          </label>
          <textarea
            id="suspend-reason"
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional — why this account is being closed, for whoever opens it next"
            className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caption text-gray-500">
            Staff only — the customer never sees it. Kept on the record and in
            the audit trail with your name. {REASON_MAX - reason.length}{' '}
            characters left.
          </p>
        </div>

        <p className="flex items-start gap-2 rounded-card border border-error/25 bg-error/5 p-3.5 text-small leading-5 text-error">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>
            Their orders, payments, and mail are kept — nothing is deleted. Only
            their access ends, and any work in flight stops with it.
          </span>
        </p>

        {message ? (
          <p role="alert" className="text-small text-error">
            {message}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}

/*
 * The other direction. No field: restoring is one decision, and the note the
 * suspension carried is cleared with it — a standing accusation against an
 * account whose access is back is not something to keep printing.
 */
export function RestoreCustomerDialog({
  customer,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: {
  customer: AdminCustomerDetail | null;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!customer) return null;

  const message = errorMessage(
    error,
    'Could not restore this account. Try again.',
  );

  return (
    <FormDialog
      open
      title="Restore access"
      size="sm"
      onClose={isSubmitting ? () => {} : onClose}
      footer={
        <div className="flex gap-3 md:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-11 flex-1 items-center justify-center rounded-control border border-gray-200 text-body font-semibold text-text transition-colors hover:bg-gray-50 disabled:opacity-50 md:flex-none md:px-5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex h-11 flex-1 items-center justify-center rounded-control bg-primary px-5 text-body font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
          >
            {isSubmitting ? 'Restoring…' : 'Restore access'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
            <ShieldCheck className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <div className="flex min-w-0 flex-col gap-1">
            <p className="min-w-0 truncate text-body font-semibold text-text">
              {customer.name}
            </p>
            <p className="text-small text-text-secondary">
              They can sign in again straight away. Their sessions were ended by
              the suspension, so they sign in fresh.
            </p>
          </div>
        </div>

        {customer.banReason ? (
          <div className="flex flex-col gap-1 rounded-card bg-gray-50 p-3.5">
            <p className="text-caption font-semibold uppercase tracking-[0.4px] text-gray-500">
              Suspended for
            </p>
            <p className="text-small text-text-secondary">{customer.banReason}</p>
          </div>
        ) : null}

        {message ? (
          <p role="alert" className="text-small text-error">
            {message}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
