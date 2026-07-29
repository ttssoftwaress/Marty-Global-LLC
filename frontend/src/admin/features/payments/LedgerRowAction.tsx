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
 */

type LedgerRowActionProps = {
  row: BillingLedgerRow;
  onAction: (row: BillingLedgerRow) => void;
  fullWidth?: boolean;
};

export function LedgerRowAction({ row, onAction, fullWidth }: LedgerRowActionProps) {
  const { kind, label } = row.action;

  if (kind === 'remind') {
    return (
      <button
        type="button"
        onClick={() => onAction(row)}
        className={`items-center justify-center whitespace-nowrap rounded-control border border-primary bg-white px-3 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light ${
          fullWidth ? 'flex h-9 w-full' : 'inline-flex h-9'
        }`}
      >
        {label}
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
