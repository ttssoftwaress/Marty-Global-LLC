import type { PaymentsKpi, PaymentsKpiTone } from '../../types/payments';

/*
 * The four headline figures. Desktop lays them 4-up, tablet and mobile fall back
 * to a 2×2 grid, matching their links.
 *
 * Every figure is resolved by the backend — `value` arrives as the string to
 * print, so no money arithmetic happens here (AGENTS.md, Money rules). The badge
 * and the caption's hue are the backend's call too: the design's amber
 * "Invoices issued · due in 15 days" is a warning tone on a KPI, not a rule
 * about the third card.
 *
 * A card with no badge simply leaves the value row's right side empty, which is
 * what three of the four design cards do.
 */

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

function KpiCard({ kpi }: { kpi: PaymentsKpi }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-gray-200 bg-white p-3.5 shadow-sm-elevation md:gap-2 md:p-5 lg:gap-3 lg:p-card">
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
    <div className="grid w-full grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}
