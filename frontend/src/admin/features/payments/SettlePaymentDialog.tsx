import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { ApiError } from '@/services/api';
import { FormDialog } from '../../components/FormDialog';
import { formatOrderDate } from '../../lib/format';
import type { SettlementRow } from '../../types/payments';
import { useAdminSettlement } from './queries';

/*
 * Confirming that money we cannot see arrived.
 *
 * This is the highest-consequence control in the admin. Nothing downstream will
 * ever contradict it: there is no bank feed to disagree with the person who
 * clicked, so the credit stands on their word alone. Three things follow from
 * that, and each one is here on purpose:
 *
 *   · THE AMOUNT IS NOT A FIELD. It is the quote's, resolved server-side. A
 *     typed figure would be crediting an invoice from a number a human entered,
 *     which AGENTS.md forbids outright — and a part payment is a conversation
 *     with the customer, not a form field.
 *   · THE DETAILS THE CUSTOMER SAW ARE REPEATED. A settler is matching a bank
 *     statement against the account the money was meant to land in, and on
 *     mobile the sheet covers the row behind it entirely.
 *   · THE REFERENCE IS UNIQUE SERVER-SIDE. Pasting the same one twice is exactly
 *     how a single transfer gets credited against two invoices, so the API
 *     refuses it rather than trusting the settler to notice.
 *
 * `paidAt` defaults to today but is editable, because a wire confirmed on Monday
 * for a Friday credit should date to Friday — that is what the quote was paid on,
 * and it is what the revenue chart will show.
 */

// Matches the backend's `settlePaymentSchema`, so the field cannot submit a
// value the API will reject.
const NOTE_MAX = 280;
const REFERENCE_MAX = 120;

// `<input type="date">` wants a plain YYYY-MM-DD in the viewer's own day, so it
// is built from the local parts rather than sliced off an ISO string — the UTC
// slice is the previous day for anyone west of Greenwich after 5pm.
function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/*
 * The instruction card as the customer saw it, frozen at intent time.
 *
 * Its own component because it FETCHES: the queue's rows no longer carry the
 * snapshot (it is a whole rendered details block per wire, and the list was
 * shipping one for every row), so it is read per payment. Rendered only while
 * the dialog is open, and usually already cached — a settler reaches this
 * dialog from the row they just expanded, which asked for the same record.
 *
 * A failed read is silent here rather than an error block: this is a
 * cross-check, and the amount, customer, and reference above it are the facts
 * the confirmation actually turns on.
 */
function WireInstructions({ payment }: { payment: SettlementRow }) {
  const detail = useAdminSettlement(payment.id);
  const instructions = detail.data?.instructions ?? [];

  if (detail.isPending) {
    return (
      <div
        aria-hidden="true"
        className="h-20 w-full animate-pulse rounded-card bg-gray-200"
      />
    );
  }

  if (instructions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-card border border-gray-200 p-3.5">
      <p className="text-caption font-semibold uppercase tracking-[0.4px] text-gray-500">
        {payment.accountLabel ?? 'Details the customer was shown'}
      </p>
      <dl className="flex flex-col gap-1.5">
        {instructions.map((field, index) => (
          <div
            key={`${field.label}-${index}`}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="shrink-0 text-caption text-gray-500">{field.label}</dt>
            <dd className="min-w-0 break-all text-right font-mono text-small text-text-secondary">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type SettlePaymentDialogProps = {
  payment: SettlementRow | null;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (input: { reference?: string; note?: string; paidAt?: string }) => void;
  onClose: () => void;
};

export function SettlePaymentDialog({
  payment,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: SettlePaymentDialogProps) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [paidAt, setPaidAt] = useState(todayLocal);

  const open = payment !== null;

  // Fresh fields per payment: carrying a reference over would file one bank
  // credit against two invoices, which the unique constraint would then refuse
  // — better not to offer it at all.
  useEffect(() => {
    if (!open) return;
    setReference('');
    setNote('');
    setPaidAt(todayLocal());
  }, [open, payment?.id]);

  if (!payment) return null;

  const isWire = payment.provider === 'wire_transfer';

  const message =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not mark this payment received. Try again.'
        : null;

  const submit = () => {
    const trimmedReference = reference.trim();
    const trimmedNote = note.trim();

    onSubmit({
      ...(trimmedReference ? { reference: trimmedReference } : {}),
      ...(trimmedNote ? { note: trimmedNote } : {}),
      // Midday local, so the date the settler picked survives conversion to UTC
      // in either direction rather than sliding a day.
      ...(paidAt ? { paidAt: new Date(`${paidAt}T12:00:00`).toISOString() } : {}),
    });
  };

  return (
    <FormDialog
      open={open}
      title="Mark payment as received"
      description={`This credits ${payment.reference ? `quote ${payment.reference}` : 'the quote'} in full and moves the order forward. It cannot be undone from here.`}
      size="md"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
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
            onClick={submit}
            disabled={isSubmitting}
            className="flex h-11 flex-1 items-center justify-center rounded-control bg-primary px-5 text-body font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
          >
            {isSubmitting ? 'Confirming…' : 'Confirm received'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* The amount reads as a fact, not an input, because it is one. */}
        <dl className="flex flex-col gap-2 rounded-card bg-gray-50 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Amount</dt>
            <dd className="text-body-lg font-semibold text-text">
              {payment.amountDisplay}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Customer</dt>
            <dd className="min-w-0 truncate text-small text-text-secondary">
              {payment.customerName}
            </dd>
          </div>
          {payment.reference ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-caption text-gray-500">Reference</dt>
              <dd className="font-mono text-small text-text-secondary">
                {payment.reference}
              </dd>
            </div>
          ) : null}
          {payment.markedSentAt ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-caption text-gray-500">Customer says sent</dt>
              <dd className="text-small text-text-secondary">
                {formatOrderDate(payment.markedSentAt)}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* What the customer was told to send to. A settler checking a statement
            needs the account beside the amount, not one screen away. */}
        <WireInstructions payment={payment} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="settle-reference" className="text-small font-medium text-text">
            {isWire ? 'Bank reference' : 'Transaction hash'}
          </label>
          <input
            id="settle-reference"
            value={reference}
            maxLength={REFERENCE_MAX}
            onChange={(event) => setReference(event.target.value)}
            placeholder={isWire ? 'e.g. FT26073100123456' : 'e.g. 0x…'}
            spellCheck={false}
            className="h-11 w-full rounded-input border border-gray-200 bg-white px-3 font-mono text-small text-text placeholder:font-sans placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caption text-gray-500">
            Optional, but worth filling in: it can only be used once, so it stops
            the same {isWire ? 'credit' : 'transfer'} being applied to a second
            invoice.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="settle-paid-at" className="text-small font-medium text-text">
            Date received
          </label>
          <input
            id="settle-paid-at"
            type="date"
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
            className="h-11 w-full rounded-input border border-gray-200 bg-white px-3 text-body text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caption text-gray-500">
            When the money landed, per your statement — not today, if they differ.
            This is the date the payment reports against.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="settle-note" className="text-small font-medium text-text">
            Note
          </label>
          <textarea
            id="settle-note"
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional — anything worth recording about this settlement"
            className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caption text-gray-500">
            Kept on the payment and the audit trail with your name.{' '}
            {NOTE_MAX - note.length} characters left.
          </p>
        </div>

        <p className="flex items-start gap-2 rounded-card border border-[var(--color-status-review-text)]/25 bg-[var(--color-status-review-bg)] p-3.5 text-small leading-5 text-[var(--color-status-review-text)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            Confirm only once you have seen the money{' '}
            {isWire ? 'on your bank statement' : 'on-chain'}. The customer&apos;s
            word that it was sent is not the same thing — this marks the invoice
            paid and starts the work.
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
 * The same decision the other way: the money never arrived, or arrived as
 * something else, so the payment is closed out and the quote goes back to
 * unpaid.
 *
 * The reason is required. This reopens a quote the customer may believe they
 * have paid, and "why" is the only thing they will ask.
 */
export function RejectSettlementDialog({
  payment,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: {
  payment: SettlementRow | null;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  const open = payment !== null;

  useEffect(() => {
    if (open) setReason('');
  }, [open, payment?.id]);

  if (!payment) return null;

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const message =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not close this payment. Try again.'
        : null;

  return (
    <FormDialog
      open={open}
      title="Close without settling"
      description="Use this when the money never arrived, or arrived as something else. The quote goes back to unpaid so the customer can try again."
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
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
            onClick={() => onSubmit(trimmed)}
            disabled={!canSubmit}
            className="flex h-11 flex-1 items-center justify-center rounded-control bg-error px-5 text-body font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
          >
            {isSubmitting ? 'Closing…' : 'Close payment'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2 rounded-card bg-gray-50 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Amount</dt>
            <dd className="text-body font-semibold text-text">
              {payment.amountDisplay}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-caption text-gray-500">Customer</dt>
            <dd className="min-w-0 truncate text-small text-text-secondary">
              {payment.customerName}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reject-reason" className="text-small font-medium text-text">
            Why?
          </label>
          <textarea
            id="reject-reason"
            rows={3}
            maxLength={NOTE_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Nothing received after 14 days; customer is paying by card instead"
            className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-caption text-gray-500">
            Kept on the payment and the audit trail with your name.{' '}
            {NOTE_MAX - reason.length} characters left.
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
