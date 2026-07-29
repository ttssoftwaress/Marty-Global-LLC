import type { MailRoomStatus } from '../../types/mailroom';

/*
 * Mail-room status pill. Reuses the design system's status-badge tokens so an
 * "Active" here reads the same as every other status pill in the portal. The
 * design shows a plain-label badge (no icon), so this stays label-only. The
 * design covers `active`; `pending` and `suspended` are real states covered
 * here rather than left to fall through.
 */

const CONFIG: Record<MailRoomStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'status-approved' },
  pending: { label: 'Pending', className: 'status-review' },
  suspended: { label: 'Suspended', className: 'status-missing' },
};

export function RoomStatusChip({ status }: { status: MailRoomStatus }) {
  const { label, className } = CONFIG[status];
  return (
    <span className={`status-badge shrink-0 px-2.5 text-small font-medium ${className}`}>
      {label}
    </span>
  );
}
