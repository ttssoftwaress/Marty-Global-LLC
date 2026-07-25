import { requestStatusStyle, requestTypeStyle } from '../../lib/mail-requests';
import type { MailRequestStatus, MailRequestType } from '../../types/mailroom';

/*
 * The two pill badges a queue row carries: what was asked for, and where it has
 * got to.
 *
 * Both share one shape — icon + label in a pill — so they are built from a
 * single private component and differ only in the tint and glyph their lib
 * lookup returns.
 *
 * The badges step down between the links exactly as drawn: 12px label with a
 * 12px glyph on desktop, 11px with a 10px glyph on tablet and mobile.
 *
 * The label is server-resolved (`typeLabel` / `statusLabel`), so the wording
 * stays owned by the API and these components only dress it.
 */

type BadgeProps = {
  label: string;
  className: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

function Badge({ label, className, icon: Icon }: BadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2 py-1 text-[11px] font-semibold lg:gap-1.5 lg:px-3 lg:py-1.5 lg:text-small ${className}`}
    >
      <Icon
        className="size-2.5 shrink-0 lg:size-3"
        strokeWidth={2}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function MailRequestTypeBadge({
  type,
  label,
}: {
  type: MailRequestType;
  label: string;
}) {
  const { icon, className } = requestTypeStyle(type);
  return <Badge label={label} className={className} icon={icon} />;
}

export function MailRequestStatusBadge({
  status,
  label,
}: {
  status: MailRequestStatus;
  label: string;
}) {
  const { icon, className } = requestStatusStyle(status);
  return <Badge label={label} className={className} icon={icon} />;
}
