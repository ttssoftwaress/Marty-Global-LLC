import { AlertTriangle, Circle, Info, type LucideIcon } from 'lucide-react';

import type { AuditSeverity } from '../../types/audit';

/*
 * The action chip on an audit row — the event's wording, tinted by how much it
 * warrants attention.
 *
 * Severity is the backend's call, derived from the action (it is not stored on
 * the entry), so re-classifying an event never needs a migration over history.
 * This map only decides the glyph and hue; the words are always `actionLabel`.
 *
 * Every chip carries a glyph, including `normal`, so severity is never conveyed
 * by hue alone — the same rule the order and team status chips follow. `normal`
 * takes a hollow dot rather than a loud icon, which is what keeps the tint
 * meaningful on the rows that do carry one.
 */

const CONFIG: Record<AuditSeverity, { icon: LucideIcon; className: string }> = {
  normal: {
    icon: Circle,
    className:
      'bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]',
  },
  notice: {
    icon: Info,
    className:
      'bg-[var(--color-status-review-bg)] text-[var(--color-status-review-text)]',
  },
  alert: {
    icon: AlertTriangle,
    className: 'bg-error/10 text-error',
  },
};

type AuditSeverityChipProps = {
  severity: AuditSeverity;
  label: string;
};

export function AuditSeverityChip({ severity, label }: AuditSeverityChipProps) {
  const { icon: Icon, className } = CONFIG[severity];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-pill px-2.5 py-1 text-small font-medium leading-4 ${className}`}
    >
      <Icon
        className="size-3 shrink-0"
        strokeWidth={severity === 'normal' ? 3 : 2.25}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
