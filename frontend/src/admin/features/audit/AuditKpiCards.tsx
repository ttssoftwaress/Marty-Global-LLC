import { formatCount } from '../../lib/format';
import type { AdminAuditSummary } from '../../types/audit';

/*
 * The three headline figures — total entries, entries in the last 24 hours, and
 * failed sign-ins in the last 24 hours.
 *
 * The third is the reason this screen has KPI cards at all. A lifetime total
 * only ever grows and tells an admin nothing; "37 failed sign-ins today" against
 * a normal handful is the signal worth opening the page for, which is why it is
 * tinted when it is non-zero and plain when it is not.
 *
 * The same grid as the rest of the admin portal: two columns on mobile with the
 * third spanning both, three from `md` up.
 */

const CARD =
  'flex flex-col gap-1 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-1.5 md:p-5 lg:gap-2 lg:p-card';

const LABEL = 'text-caption font-medium uppercase tracking-[0.6px] text-gray-500';

const VALUE =
  'text-[2rem] font-semibold leading-10 text-text lg:text-[2.25rem] lg:leading-[2.75rem]';

export function AuditKpiCards({ summary }: { summary: AdminAuditSummary }) {
  const hasFailures = summary.failedSignIns > 0;

  const cards = [
    { label: 'Total entries', value: summary.totalEntries, alert: false },
    { label: 'Last 24 hours', value: summary.entriesToday, alert: false },
    {
      label: 'Failed sign-ins (24h)',
      value: summary.failedSignIns,
      alert: hasFailures,
    },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-6">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className={`${CARD} ${index === 2 ? 'col-span-2 md:col-span-1' : ''} ${
            card.alert ? 'border-error/30 bg-error/5' : ''
          }`}
        >
          <p className={`${LABEL} ${card.alert ? 'text-error' : ''}`}>
            {card.label}
          </p>
          <p className={`${VALUE} ${card.alert ? 'text-error' : ''}`}>
            {formatCount(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
