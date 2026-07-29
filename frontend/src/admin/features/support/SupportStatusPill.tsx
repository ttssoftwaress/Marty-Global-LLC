import type { SupportStatus } from '../../types/support';

/*
 * A conversation's state, as a small read-only pill.
 *
 * The thread header already carries a status control (SupportStatusMenu); this is
 * the same three states at list scale, where there is nothing to change — so it
 * is a `span`, not a button, and never opens anything.
 *
 * The tints are deliberately the menu's own, rather than a second palette for the
 * same three words: a thread that reads amber in the list must not read blue when
 * it is opened. A leading dot travels with the tint so the state is not carried by
 * colour alone.
 */

const STATUS_STYLES: Record<SupportStatus, { pill: string; dot: string }> = {
  open: { pill: 'status-info', dot: 'bg-info' },
  pending: { pill: 'status-review', dot: 'bg-warning' },
  resolved: { pill: 'status-approved', dot: 'bg-success' },
};

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
};

export function SupportStatusPill({
  status,
  className,
}: {
  status: SupportStatus;
  className?: string;
}) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-1.5 py-0.5 text-[0.625rem] font-semibold leading-4 md:px-1.5 md:py-0 lg:px-2 lg:py-0.5 lg:text-caption ${styles.pill} ${className ?? ''}`}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${styles.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
