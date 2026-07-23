import { AlertTriangle, Check, Mail, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatRelativeTime } from '../../lib/format';
import type { DashboardActivity } from '../../types/dashboard';

/*
 * Recent activity — a timeline of what changed on the account. Each row is an
 * icon chip, a sentence with the key term emphasised, an optional call to
 * action, and a relative timestamp. Alert rows carry a red left rule.
 *
 * The layout is identical at every width — only the type scale steps up on
 * desktop — so this renders one tree rather than per-breakpoint variants.
 */

const ICONS: Record<DashboardActivity['icon'], LucideIcon> = {
  order: RefreshCw,
  mail: Mail,
  payment: Check,
  alert: AlertTriangle,
};

const TONE_CHIP: Record<DashboardActivity['tone'], string> = {
  info: 'bg-[#e0f2fe] text-info',
  success: 'bg-[var(--color-status-approved-bg)] text-success',
  alert: 'bg-[var(--color-status-missing-bg)] text-error',
};

type RecentActivityProps = {
  activity: DashboardActivity[];
};

export function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-5">
      <h2 className="text-body-lg font-semibold text-text lg:text-h6">
        Recent activity
      </h2>

      {activity.length === 0 ? (
        <p className="py-4 text-body text-gray-500">
          No activity yet — updates on your orders and mail will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 lg:gap-2">
          {activity.map((item) => {
            const Icon = ICONS[item.icon];

            return (
              <li
                key={item.id}
                className={`flex gap-3 rounded-lg p-3 ${
                  item.tone === 'alert' ? 'border-l-[3px] border-error' : ''
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-[16px] ${TONE_CHIP[item.tone]}`}
                >
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-body leading-[1.4] text-text">
                    {item.message.map((segment, index) =>
                      segment.emphasis ? (
                        <strong key={index} className="font-semibold">
                          {segment.text}
                        </strong>
                      ) : (
                        <span key={index}>{segment.text}</span>
                      ),
                    )}
                  </p>

                  {item.action ? (
                    <Link
                      to={item.action.to}
                      className="text-small font-medium text-primary transition-colors hover:text-primary-hover"
                    >
                      {item.action.label} →
                    </Link>
                  ) : null}

                  <p className="text-small text-gray-400">
                    {formatRelativeTime(item.occurredAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
