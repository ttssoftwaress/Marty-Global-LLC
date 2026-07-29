import type { MailOpsKpi } from '../../types/mailroom';

/*
 * The three headline figures.
 *
 * Desktop and tablet lay them 3-up; mobile puts two on the first row and gives
 * the third the full width, which is what the mobile link draws. A two-column
 * grid with the last card spanning both columns reproduces that with one tree,
 * and degrades sensibly if the backend ever returns a different number of
 * cards — the span only applies to a trailing odd card.
 *
 * Every figure comes from the API pre-resolved as the string to print; the UI
 * never counts anything itself.
 *
 * The mobile link prints its figures in brand navy while the wider links print
 * them in near-black. We use near-black at every width (logged as a deviation):
 * these are neutral counts, not the brand-tinted emphasis navy carries
 * elsewhere in the admin area, and the KPI cards on every other admin screen
 * print their value in `text-text`.
 */

function KpiCard({ kpi, isLastOdd }: { kpi: MailOpsKpi; isLastOdd: boolean }) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:gap-3 lg:p-card ${
        isLastOdd ? 'col-span-2 md:col-span-1' : ''
      }`}
    >
      <p className="text-caption font-semibold uppercase tracking-[0.4px] text-text-secondary">
        {kpi.label}
      </p>
      <p className="text-[2rem] font-semibold leading-10 text-text">{kpi.value}</p>
    </div>
  );
}

export function MailOpsKpiCards({ kpis }: { kpis: MailOpsKpi[] }) {
  if (kpis.length === 0) return null;

  return (
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
      {kpis.map((kpi, index) => (
        <KpiCard
          key={kpi.id}
          kpi={kpi}
          isLastOdd={index === kpis.length - 1 && kpis.length % 2 === 1}
        />
      ))}
    </div>
  );
}
