import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PaymentStatusView } from '../../types/payments';

/*
 * The payment's state as a pill, reusing the design system's status-badge
 * tokens so it reads like every other status chip in the portal.
 *
 * Under- and overpayment get their own visible states rather than collapsing
 * into "failed": AGENTS.md requires a mismatch be explicit, and from the
 * customer's side "we got your money but the amount was off" is a very
 * different message from "your payment failed".
 */

const CONFIG: Record<
  PaymentStatusView,
  { label: string; icon: LucideIcon; className: string; spin?: boolean }
> = {
  awaiting_payment: {
    label: 'Awaiting payment',
    icon: Clock,
    className: 'status-review',
  },
  confirming: {
    label: 'Confirming',
    icon: Loader2,
    className: 'status-submitted',
    spin: true,
  },
  succeeded: { label: 'Paid', icon: Check, className: 'status-approved' },
  failed: { label: 'Failed', icon: AlertTriangle, className: 'status-missing' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'status-draft' },
  // Neutral, not red: the customer closed the window on purpose and nothing
  // went wrong — the quote is simply still there to pay.
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'status-draft' },
  underpaid: {
    label: 'Underpaid',
    icon: AlertTriangle,
    className: 'status-missing',
  },
  overpaid: { label: 'Overpaid', icon: TrendingUp, className: 'status-review' },
};

export function PaymentStateChip({ status }: { status: PaymentStatusView }) {
  const { label, icon: Icon, className, spin } = CONFIG[status];

  return (
    <span className={`status-badge gap-1.5 px-2.5 text-small font-medium ${className}`}>
      <Icon
        className={`size-3.5 shrink-0 ${spin ? 'animate-spin' : ''}`}
        strokeWidth={2}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
