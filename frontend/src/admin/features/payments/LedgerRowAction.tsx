import { Link } from 'react-router-dom';

import type { BillingLedgerRow } from '../../types/payments';

/*
 * A ledger row's action control. Which one a row gets is the backend's call
 * (`row.action.kind`), so the UI never infers an action from a status:
 *
 *   - `remind` — an outlined button, the design's treatment for "Send reminder"
 *   - `view`   — a link to the order, since that action only navigates
 *
 * The `-` (`kind: 'none'`) case never reaches this component; the table prints
 * the dash.
 *
 * `fullWidth` is what the mobile cards pass, where the control spans the card.
 *
 * A reminder is an email to a customer, so the button owes the two states the
 * design doesn't draw (Design.md): it says "Sending…" and cannot be pressed
 * again while its mutation is in flight, and it renders disabled with the
 * backend's own reason when a chase has already gone out inside the cooldown.
 * The reason is a `title` as well as an `aria-describedby` target on the page,
 * so it is not pointer-only.
 */

type LedgerRowActionProps = {
  row: BillingLedgerRow;
  onAction: (row: BillingLedgerRow) => void;
  fullWidth?: boolean;
  /** This row's reminder is in flight. */
  isSending?: boolean;
  /** Any row's reminder is in flight — one chase at a time. */
  isBusy?: boolean;
};

export function LedgerRowAction({
  row,
  onAction,
  fullWidth,
  isSending,
  isBusy,
}: LedgerRowActionProps) {
  const { kind, label, disabledReason } = row.action;

  if (kind === 'remind') {
    const disabled = Boolean(disabledReason) || Boolean(isBusy);

    return (
      <button
        type="button"
        onClick={() => onAction(row)}
        disabled={disabled}
        title={disabledReason}
        aria-label={disabledReason ? `${label} — ${disabledReason}` : undefined}
        className={`items-center justify-center whitespace-nowrap rounded-control border border-primary bg-white px-3 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-white disabled:text-gray-400 ${
          fullWidth ? 'flex h-9 w-full' : 'inline-flex h-9'
        }`}
      >
        {isSending ? 'Sending…' : label}
      </button>
    );
  }

  return (
    <Link
      to={row.to}
      className={`items-center justify-center whitespace-nowrap rounded-control text-body font-medium text-gray-600 transition-colors hover:text-primary hover:underline ${
        fullWidth ? 'flex h-9 w-full border border-gray-300' : 'inline-flex'
      }`}
    >
      {label}
    </Link>
  );
}
