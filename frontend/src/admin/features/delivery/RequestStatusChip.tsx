import { AlertTriangle, CheckCircle2, Clock, Sparkles, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ServiceRequestStatus } from '../../types/delivery';

/*
 * A request's state as the operator reads it.
 *
 * Deliberately worded differently from the customer's chip: staff see "Blocked"
 * because that is what it is on their queue, while the customer's page says
 * "Needs attention" because the reason is almost always something we need from
 * them. Same state, two audiences — so two labels, not one shared component.
 */

const VIEW: Record<
  ServiceRequestStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  submitted: {
    label: 'Submitted',
    icon: Clock,
    className:
      'bg-[var(--color-status-review-bg)] text-[color:var(--color-status-review-text)]',
  },
  in_progress: {
    label: 'In progress',
    icon: Sparkles,
    className: 'bg-primary-light text-primary',
  },
  blocked: {
    label: 'Blocked',
    icon: AlertTriangle,
    className:
      'bg-[var(--color-status-missing-bg)] text-[color:var(--color-status-missing-text)]',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className:
      'bg-[var(--color-status-completed-bg)] text-[color:var(--color-status-completed-text)]',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-gray-100 text-gray-500',
  },
};

export function RequestStatusChip({ status }: { status: ServiceRequestStatus }) {
  const view = VIEW[status];
  const Icon = view.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold ${view.className}`}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
      {view.label}
    </span>
  );
}
