import { AlertTriangle, Check, Clock, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PaymentStatus, QuoteStatus } from '../../types/billing';

/*
 * Billing status pills — icon + label, one style per state. They reuse the
 * design system's status-badge tokens so a "Pending" or "Paid" here reads the
 * same as every other status pill in the portal (OrderStatusChip, PaymentChip).
 * The design covers `pending` and `paid`; the extra states are real terminal
 * statuses, covered here rather than left to fall through.
 */

const QUOTE_CONFIG: Record<
  QuoteStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pending: { label: 'Pending', icon: Clock, className: 'status-review' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'status-missing' },
};

export function QuoteStatusChip({ status }: { status: QuoteStatus }) {
  const { label, icon: Icon, className } = QUOTE_CONFIG[status];
  return (
    <span className={`status-badge gap-1.5 px-2.5 text-small font-medium ${className}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}

const PAYMENT_CONFIG: Record<
  PaymentStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  paid: { label: 'Paid', icon: Check, className: 'status-approved' },
  refunded: { label: 'Refunded', icon: RotateCcw, className: 'status-draft' },
  failed: { label: 'Failed', icon: AlertTriangle, className: 'status-missing' },
};

export function PaymentStatusChip({ status }: { status: PaymentStatus }) {
  const { label, icon: Icon, className } = PAYMENT_CONFIG[status];
  return (
    <span className={`status-badge gap-1.5 px-2.5 text-small font-medium ${className}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}
