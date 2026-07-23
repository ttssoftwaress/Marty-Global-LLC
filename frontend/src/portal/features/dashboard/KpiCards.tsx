import { Link } from 'react-router-dom';

import { formatMoney } from '../../lib/format';
import type { DashboardMetrics } from '../../types/dashboard';

/*
 * KPI row — four metric cards. Desktop lays them out 4-up; tablet and mobile
 * fall back to a 2×2 grid, matching their Figma links.
 *
 * The Figma link renders each card's footer as plain text; here it is a real
 * link to the section it names, since that is plainly the intent and a
 * non-interactive navy label would be misleading.
 */

type KpiCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
  badge?: { text: string; className: string };
  dot?: boolean;
  /** Formatted money rather than a small count — needs a smaller value size. */
  wide?: boolean;
  linkLabel: string;
  to: string;
};

function KpiCard({
  label,
  value,
  valueClassName,
  badge,
  dot,
  wide,
  linkLabel,
  to,
}: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-2 md:p-5 lg:gap-3 lg:border-0 lg:p-card">
      <p className="text-caption font-semibold uppercase text-gray-500 lg:font-medium">
        {label}
      </p>

      {/*
       * Figma keeps the value and its chip on one line. A formatted amount is
       * far wider than a single-digit count, so money values step down one
       * size at the widths where a quarter-width card would otherwise clip
       * them, rather than truncating a number.
       */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        <p
          className={`text-h5 font-bold md:text-h4 ${wide ? 'lg:text-h4' : 'lg:text-h3'} ${valueClassName ?? 'text-text'}`}
        >
          {value}
        </p>

        {badge ? (
          <span
            className={`status-badge shrink-0 px-2 text-caption font-medium ${badge.className}`}
          >
            {badge.text}
          </span>
        ) : null}

        {dot ? (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-error"
          />
        ) : null}
      </div>

      <div className="mt-auto flex justify-end">
        <Link
          to={to}
          className="text-small font-medium text-primary transition-colors hover:text-primary-hover lg:font-medium"
        >
          {linkLabel}
        </Link>
      </div>
    </div>
  );
}

export function KpiCards({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid w-full grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 lg:gap-6">
      <KpiCard
        label="Active orders"
        value={String(metrics.activeOrders)}
        linkLabel="My orders"
        to="/app/orders"
      />

      <KpiCard
        label="Amount due"
        value={formatMoney(metrics.amountDue)}
        wide
        valueClassName={
          metrics.amountDue.amount > 0 ? 'text-[var(--color-status-review-text)]' : 'text-text'
        }
        badge={
          metrics.amountDue.amount > 0
            ? { text: 'Payable', className: 'status-review' }
            : undefined
        }
        linkLabel="Billing"
        to="/app/billing"
      />

      <KpiCard
        label="Unread mail"
        value={String(metrics.unreadMail)}
        dot={metrics.unreadMail > 0}
        linkLabel="Inboxes"
        to="/app/mailroom"
      />

      <KpiCard
        label="Pending messages"
        value={String(metrics.pendingMessages)}
        linkLabel="Messages"
        to="/app/messages"
      />
    </div>
  );
}
