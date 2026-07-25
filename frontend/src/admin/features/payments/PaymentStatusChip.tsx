import { AlertCircle, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PaymentStatus } from '../../types/payments';

/*
 * Payment status pill — used by the ledger table rows and the mobile cards, so a
 * status reads identically in both.
 *
 * Colors are the design system's status tokens, matching the design's swatches:
 * paid uses the approved (green) pair, pending payment the review (amber) pair,
 * refunded the brand tint with secondary-navy text. `failed` and
 * `partially_refunded` are states the design never drew — the backend's status
 * enum has them, so they get the missing (red) and review pairs rather than
 * crashing on a missing key.
 *
 * `Refunded` carries an icon here where the design leaves it bare, so every chip
 * in the column has the same silhouette and the status is not conveyed by hue
 * alone.
 *
 * The label is the backend's word for the status (`statusLabel` on the row); the
 * map below only decides the glyph and hue.
 */

const CONFIG: Record<PaymentStatus, { icon: LucideIcon; className: string }> = {
  paid: { icon: CheckCircle2, className: 'status-approved' },
  pending_payment: { icon: Clock, className: 'status-review' },
  refunded: { icon: RotateCcw, className: 'bg-primary-light text-secondary' },
  partially_refunded: { icon: RotateCcw, className: 'status-review' },
  failed: { icon: AlertCircle, className: 'status-missing' },
};

type PaymentStatusChipProps = {
  status: PaymentStatus;
  label: string;
};

export function PaymentStatusChip({ status, label }: PaymentStatusChipProps) {
  const { icon: Icon, className } = CONFIG[status];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-pill px-2 py-1 text-caption font-semibold leading-4 md:gap-1.5 md:px-2.5 ${className}`}
    >
      <Icon className="size-3 shrink-0 md:size-3.5" strokeWidth={2} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
