import { formatCount } from '../../lib/format';
import type { TrashSummary } from '../../types/trash';

/*
 * Three figures: what is in the bin, what is about to leave it, and how long
 * anything gets.
 *
 * The middle one is why this screen has KPI cards at all. A total only says how
 * untidy the database is; "6 expiring this week" is the number that turns Trash
 * from an archive into something worth opening — those are the records whose
 * last chance of recovery is now. It is tinted when it is non-zero and plain
 * when it is not, the same rule the audit log's failed-sign-in card follows.
 *
 * The third card prints the window rather than a count, and reads "Paused" when
 * the sweep is switched off: with automatic deletion stood down, "30 days" would
 * be a deadline that is not actually running.
 *
 * The same grid as the rest of the admin portal: two columns on mobile with the
 * third spanning both, three from `md` up.
 */

const CARD =
  'flex flex-col gap-1 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-1.5 md:p-5 lg:gap-2 lg:p-card';

const LABEL = 'text-caption font-medium uppercase tracking-[0.6px] text-gray-500';

const VALUE =
  'text-[2rem] font-semibold leading-10 text-text lg:text-[2.25rem] lg:leading-[2.75rem]';

export function TrashKpiCards({ summary }: { summary: TrashSummary }) {
  const expiring = summary.expiringSoon > 0;

  const retentionValue = !summary.purgeEnabled
    ? 'Paused'
    : `${summary.retentionDays} day${summary.retentionDays === 1 ? '' : 's'}`;

  return (
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-6">
      <div className={CARD}>
        <p className={LABEL}>In Trash</p>
        <p className={VALUE}>{formatCount(summary.totalEntries)}</p>
      </div>

      <div className={`${CARD} ${expiring ? 'border-error/30 bg-error/5' : ''}`}>
        <p className={`${LABEL} ${expiring ? 'text-error' : ''}`}>
          Expiring this week
        </p>
        <p className={`${VALUE} ${expiring ? 'text-error' : ''}`}>
          {formatCount(summary.expiringSoon)}
        </p>
      </div>

      <div className={`${CARD} col-span-2 md:col-span-1`}>
        <p className={LABEL}>Retention</p>
        <p className={VALUE}>{retentionValue}</p>
      </div>
    </div>
  );
}
