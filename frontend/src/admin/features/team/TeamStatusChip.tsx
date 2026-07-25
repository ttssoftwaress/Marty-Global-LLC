import { Check, Mail, MinusCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { TeamMemberStatus } from '../../types/team';

/*
 * Team member status pill — used by the table rows and the mobile cards, so a
 * status reads identically in both.
 *
 * Colors are the design system's status tokens, matching the links' swatches:
 * active uses the approved (green) pair, invited the info (sky) pair. The links
 * offer a "Deactivated" filter tab but never draw the chip, so it takes the
 * draft (grey) pair here — a state the design did not cover (Design.md).
 *
 * `deactivated` carries a glyph like the other two, so every chip in the column
 * has the same silhouette and the status is not conveyed by hue alone.
 *
 * The label is the backend's word for the status (`statusLabel` on the row); the
 * map below only decides the glyph and hue.
 */

const CONFIG: Record<TeamMemberStatus, { icon: LucideIcon; className: string }> =
  {
    active: {
      icon: Check,
      className:
        'bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]',
    },
    invited: { icon: Mail, className: 'bg-[#e0f2fe] text-info' },
    deactivated: {
      icon: MinusCircle,
      className:
        'bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]',
    },
  };

type TeamStatusChipProps = {
  status: TeamMemberStatus;
  label: string;
};

export function TeamStatusChip({ status, label }: TeamStatusChipProps) {
  const { icon: Icon, className } = CONFIG[status];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-pill px-2.5 py-1 text-small font-medium leading-4 ${className}`}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
