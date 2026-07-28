import type { PaymentsKpi, PaymentsKpiTone } from '../../types/payments';

/*
 * The headline figures. Desktop lays them out one per column, tablet and mobile
 * fall back to a two-column grid, matching their links. The column count follows
 * the number of cards the backend sends rather than a fixed four, so a KPI added
 * or dropped server-side never leaves a hole in the row.
 *
 * Every figure is resolved by the backend — `value` arrives as the string to
 * print, so no money arithmetic happens here (AGENTS.md, Money rules). The badge
 * and the caption's hue are the backend's call too: the design's amber
 * "Invoices issued · due in 15 days" is a warning tone on a KPI, not a rule
 * about the third card.
 *
 * A card with no badge simply leaves the value row's right side empty, which is
 * what most of the design's cards do.
 */

// Static class strings — Tailwind cannot see a class assembled at runtime.
const COLUMNS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

const CAPTION_TONE: Record<PaymentsKpiTone, string> = {
  neutral: 'text-gray-500',
  warning: 'text-[var(--color-status-review-text)]',
  success: 'text-success',
};

const BADGE_TONE: Record<PaymentsKpiTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  warning: 'bg-[var(--color-status-review-bg)] text-[var(--color-status-review-text)]',
  success:
    'bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]',
};

function KpiCard({
  kpi,
  fullWidthOnNarrow,
}: {
  kpi: PaymentsKpi;
  fullWidthOnNarrow?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-card border border-gray-200 bg-white p-3.5 shadow-sm-elevation md:gap-2 md:p-5 lg:gap-3 lg:p-card ${
        fullWidthOnNarrow ? 'col-span-2 lg:col-span-1' : ''
      }`}
    >
      <p className="text-caption font-medium uppercase tracking-[0.6px] text-text-secondary">
        {kpi.label}
      </p>

      {/*
       * Value and badge share a line from `md` up, as the desktop and tablet
       * links show. Mobile's card is too narrow for that, so the badge wraps
       * beneath — matching the mobile link, where it sits on its own row.
       */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-[22px] font-semibold leading-8 text-text md:text-[26px] md:leading-9 lg:text-[28px] lg:leading-10">
          {kpi.value}
        </p>

        {kpi.badge ? (
          <span
            className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-caption font-semibold leading-4 md:py-1 ${
              BADGE_TONE[kpi.badge.tone]
            }`}
          >
            {kpi.badge.label}
          </span>
        ) : null}
      </div>

      <p
        className={`mt-auto text-caption leading-4 md:text-small ${
          CAPTION_TONE[kpi.captionTone]
        }`}
      >
        {kpi.caption}
      </p>
    </div>
  );
}

export function PaymentsKpiCards({ kpis }: { kpis: PaymentsKpi[] }) {
  if (kpis.length === 0) return null;

  return (
    <div
      className={`grid w-full grid-cols-2 gap-2 md:gap-4 ${
        COLUMNS[kpis.length] ?? 'lg:grid-cols-4'
      }`}
    >
      {kpis.map((kpi, index) => (
        <KpiCard
          key={kpi.id}
          kpi={kpi}
          // An odd trailing card would sit half-width beside empty space in the
          // two-column grid, so it spans the row below `lg` instead.
          fullWidthOnNarrow={kpis.length % 2 === 1 && index === kpis.length - 1}
        />
      ))}
    </div>
  );
}
