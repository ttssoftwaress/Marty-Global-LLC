import { AlertTriangle, Check, Clock, FileEdit, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { OrderStatus } from '../../types/dashboard';

/*
 * Order status pill — icon + label, one style per status. Shared by the desktop
 * and tablet tables and the mobile order cards so a status reads identically at
 * every width.
 *
 * Colors come from the design system's status tokens (`.status-badge` +
 * `.status-*`), which already carry the exact bg/text pairs the design uses.
 * `draft` is not in the Figma context but is a real order status, so it is
 * covered here rather than left to fall through.
 */

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  draft: { label: 'Draft', icon: FileEdit, className: 'status-draft' },
  submitted: { label: 'Submitted', icon: Send, className: 'status-submitted' },
  under_review: { label: 'Under review', icon: Clock, className: 'status-review' },
  missing_info: { label: 'Missing info', icon: AlertTriangle, className: 'status-missing' },
  approved: { label: 'Approved', icon: Check, className: 'status-approved' },
  completed: { label: 'Completed', icon: Check, className: 'status-completed' },
};

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const { label, icon: Icon, className } = STATUS_CONFIG[status];

  return (
    <span className={`status-badge gap-1.5 px-2.5 text-small font-medium ${className}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {label}
    </span>
  );
}
