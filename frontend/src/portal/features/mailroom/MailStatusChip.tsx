import { AlertTriangle, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { MailStatus } from '../../types/mailroom';

/*
 * Mail-item status pill — icon + label, one style per state. Labels follow the
 * desktop link (the copy source): "Viewed" not the mobile "Opened", "Action
 * requested" not the mobile "Action required".
 *
 * The red/neutral states reuse the design system's status-badge color tokens
 * (`.status-missing` / `.status-draft`) so they read the same as every other
 * status pill in the portal. `new`/`forwarded` are the navy "in transit" pill —
 * no status token pairs navy bg with navy text, so that one composes from the
 * brand tokens directly.
 *
 * The links' green "Scanned" pill has no entry: it is not a state the backend
 * can produce (types/mailroom.ts, MailStatus).
 */

const CONFIG: Record<
  MailStatus,
  { label: string; icon?: LucideIcon; className: string }
> = {
  new: { label: 'New', icon: Send, className: 'bg-primary-light text-primary' },
  forwarded: {
    label: 'Forwarded',
    icon: Send,
    className: 'bg-primary-light text-primary',
  },
  viewed: { label: 'Viewed', className: 'status-draft' },
  archived: { label: 'Archived', className: 'status-draft' },
  action_requested: {
    label: 'Action requested',
    icon: AlertTriangle,
    className: 'status-missing',
  },
};

export function MailStatusChip({ status }: { status: MailStatus }) {
  const { label, icon: Icon, className } = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 text-small font-semibold ${className}`}
    >
      {Icon ? (
        <Icon className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}
