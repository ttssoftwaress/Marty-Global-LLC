import type { DocumentStats } from '../../types/documents';

/*
 * The three headline figures. One tree serves every viewport: mobile lays the
 * first two side by side with the third full-width beneath (a 2-col grid where
 * the last card spans both), tablet and desktop line all three up in a row —
 * the same shape the mail-room KPI row uses, so the two screens read as one
 * system.
 *
 * "Awaiting" carries an amber dot while anything is outstanding: a pending
 * document is one we owe the customer, and it is the only figure here that
 * represents something not yet done.
 */

type KpiCard = {
  label: string;
  value: number;
  tint?: boolean;
  spanFull?: boolean;
};

export function DocumentsKpiCards({ stats }: { stats: DocumentStats }) {
  const cards: KpiCard[] = [
    { label: 'All documents', value: stats.total },
    { label: 'Filed by us', value: stats.fromUs },
    { label: 'Awaiting', value: stats.pending, tint: true, spanFull: true },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:p-card ${
            card.spanFull ? 'col-span-2 md:col-span-1' : ''
          }`}
        >
          <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500 md:text-gray-400 lg:text-small">
            {card.label}
          </p>
          <p className="flex items-center gap-2 text-h3 font-semibold text-text md:text-h4 lg:text-h3">
            {card.value}
            {card.tint && card.value > 0 ? (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-[color:var(--color-status-review-text)] lg:size-2"
              />
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}
