import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Loader,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { OrderStatus } from '../../types/orders';

/*
 * Order status pill — icon + label, one style per state, used by both the table
 * rows and the mobile cards.
 *
 * The colors are the design system's status tokens, so a status reads the same
 * here as on any other badge in the app. `submitted` pairs the navy brand tint
 * with navy text (the design's own choice for that state) rather than the
 * indigo `--color-status-submitted-*` pair, and `completed` is the solid navy
 * token — both match their Figma swatches.
 *
 * The label is the backend's word for the status; `statusLabel` from the row is
 * what renders, so a wording change never needs a frontend deploy. The map here
 * only decides the glyph and hue.
 */

const CONFIG: Record<OrderStatus, { icon: LucideIcon; className: string }> = {
  draft: { icon: FileText, className: 'status-draft' },
  submitted: {
    icon: ArrowUpRight,
    className: 'bg-primary-light text-primary',
  },
  under_review: { icon: Clock, className: 'status-review' },
  missing_info: { icon: AlertCircle, className: 'status-missing' },
  approved: { icon: CheckCircle2, className: 'status-approved' },
  paid: { icon: CreditCard, className: 'status-paid' },
  processing: { icon: Loader, className: 'status-processing' },
  completed: { icon: Check, className: 'status-completed' },
};

type OrderStatusChipProps = {
  status: OrderStatus;
  label: string;
};

export function OrderStatusChip({ status, label }: OrderStatusChipProps) {
  const { icon: Icon, className } = CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold leading-4 md:gap-1.5 md:text-small ${className}`}
    >
      <Icon className="size-3 shrink-0 md:size-3.5" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}
