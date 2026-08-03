import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

import { ApiError } from '@/services/api';
import { useOverlay } from '../../../hooks/useOverlay';
import type { PaymentMethodKind } from '../../types/payments';

/*
 * The one question worth interrupting for: have you already sent it?
 *
 * TRC-20 transfers carry no memo, so a payment is identified by its exact
 * amount at a watched address. Cancelling stops that watch. If the customer has
 * already broadcast a transfer, cancelling turns their money into an
 * unattributed arrival a human has to reconcile — so the copy leads with that,
 * not with the usual "are you sure".
 *
 * Two reasons open it, one action behind both:
 *
 *   · `explicit`   — the Cancel transfer button on the payment panel.
 *   · `navigation` — they tried to leave the page while the window was open.
 *
 * Standard dialog behaviour the design never covered: the backdrop dismisses it,
 * and `useOverlay` owns Escape, the body scroll lock, focus moving in on open
 * and back on close, and the Tab trap while open (Design.md — filling in the
 * states).
 */

type CancelTransferDialogProps = {
  open: boolean;
  reason: 'explicit' | 'navigation';
  /**
   * Which payment is being cancelled. Only the copy changes: "we'd stop watching
   * for it" is true of a watched on-chain amount and false of a bank transfer,
   * where the risk is a wire already in flight against a payment we have closed.
   */
  provider: PaymentMethodKind;
  /** "4:12" while the window is still running, so the copy can name it. */
  remainingLabel: string | null;
  isSubmitting: boolean;
  error: unknown;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function CancelTransferDialog({
  open,
  reason,
  provider,
  remainingLabel,
  isSubmitting,
  error,
  onConfirm,
  onDismiss,
}: CancelTransferDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useOverlay({ open, onClose: onDismiss, panelRef });

  if (!open) return null;

  const isWire = provider === 'wire_transfer';

  const title = isWire
    ? 'Cancel this payment?'
    : reason === 'navigation'
      ? 'Your payment window is still open'
      : 'Cancel this transfer?';

  const lead = isWire
    ? "Cancelling closes this payment and puts the bank details away. We won't be expecting your transfer any more."
    : reason === 'navigation'
      ? remainingLabel
        ? `You have ${remainingLabel} left to send this payment. Leaving won't close the window on its own — we'd still be watching for your transfer.`
        : "Leaving won't close the payment window on its own — we'd still be watching for your transfer."
      : 'Cancelling closes this payment window and stops us watching for your transfer.';

  const message =
    error instanceof ApiError
      ? error.message
      : error
        ? "We couldn't cancel this payment. Please try again."
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onDismiss}
        data-press="none"
        className="absolute inset-0 cursor-default bg-gray-900/40 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex w-full translate-y-0 flex-col rounded-t-modal bg-white opacity-100 shadow-lg-elevation outline-none transition-[opacity,translate] duration-200 ease-out starting:translate-y-8 starting:opacity-0 motion-reduce:transition-none md:max-w-[30rem] md:rounded-modal"
      >
        {/* The grabber reads as "drag me down", so it is mobile-only. */}
        <div className="flex justify-center pb-1 pt-3 md:hidden">
          <span aria-hidden="true" className="h-1 w-9 rounded-pill bg-gray-300" />
        </div>

        <div className="flex flex-col gap-4 px-4 pb-6 pt-2 md:px-6 md:pt-6">
          <div className="flex items-start gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[1.375rem] bg-[var(--color-status-review-bg)]">
              <AlertTriangle
                className="size-5 text-[var(--color-status-review-text)]"
                strokeWidth={2}
                aria-hidden="true"
              />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-h6 font-semibold text-text">{title}</h2>
              <p className="text-body leading-6 text-gray-500">{lead}</p>
            </div>
          </div>

          {/*
            The load-bearing sentence. Everything else on this screen is
            reversible; money sent against a payment nobody is expecting is not.
          */}
          <p className="rounded-card border border-[var(--color-status-missing-text)]/20 bg-[var(--color-status-missing-bg)] p-3.5 text-small leading-5 text-error">
            <strong className="font-semibold">
              Only cancel if you haven&apos;t sent anything yet.
            </strong>{' '}
            {isWire
              ? "If your bank transfer is already on its way, keep this payment open — our team will match it when it arrives."
              : "If you've already sent USDT to this address, keep the window open — we'll match your transfer as soon as it appears on-chain."}
          </p>

          <p className="text-small leading-5 text-text-secondary">
            Your quote stays open either way, and nothing has been charged. You
            can start the payment again from your billing page whenever you like.
          </p>

          {message ? (
            <p role="alert" className="text-small text-error">
              {message}
            </p>
          ) : null}
        </div>

        {/* Footer clears the home indicator on mobile. */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:flex-row md:justify-end md:px-6 md:pb-5">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSubmitting}
            className="flex h-11 items-center justify-center rounded-control border border-gray-200 px-5 text-body font-semibold text-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Keep the window open
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex h-11 items-center justify-center rounded-control bg-error px-5 text-body font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Cancelling…'
              : isWire
                ? 'Cancel payment'
                : reason === 'navigation'
                  ? 'Cancel transfer and leave'
                  : 'Cancel transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
