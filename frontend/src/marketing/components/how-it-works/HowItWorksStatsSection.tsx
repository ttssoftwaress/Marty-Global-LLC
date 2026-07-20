/*
 * How It Works — Stats strip. A row of four proof-point stat cards (big Poppins
 * number over a muted label) on a white surface, sitting between the timeline
 * and the dashboard section. Three breakpoints per Figma:
 *   - mobile (<768px):  pt-6 pb-10 px-5, cards in a 2×2 grid (12px gap). Cards
 *     are p-4, radius 12px, a soft 0px/2px/4px shadow, 4px inner gap; number
 *     24px, label 12px.
 *   - tablet (md, 768px): px-10 py-12, cards 376px wide wrapping two-up and
 *     centered (16px gap). Cards are p-5, radius 16px, 0px/4px/6px shadow, 6px
 *     inner gap; number 28px, label 13px.
 *   - desktop (lg, 1024px): px-20 py-16, all four cards in one equal-width row
 *     (24px gap). Cards are p-6, radius 16px, 0px/4px/6px shadow, 8px inner gap;
 *     number 32px, label 14px.
 * Numbers use Poppins (700 — the heaviest weight the marketing font loads) in
 * primary navy; labels are the secondary text tone. Copy is the desktop wording
 * at every breakpoint (mobile's abbreviated labels are ignored per the design
 * source-of-truth rule).
 */

type Stat = {
  value: string;
  label: string;
};

const STATS: Stat[] = [
  { value: '24 Hours', label: 'Average Review Time' },
  { value: '5 Days', label: 'Average Completion' },
  { value: '2,500+', label: 'Orders Processed' },
  { value: '98%', label: 'Client Satisfaction' },
];

export function HowItWorksStatsSection() {
  return (
    <section className="flex w-full flex-col items-center bg-white px-5 pb-10 pt-6 md:px-10 md:py-12 lg:px-20 lg:py-16">
      <div className="grid w-full grid-cols-2 gap-3 md:flex md:flex-wrap md:content-center md:justify-center md:gap-4 lg:flex-nowrap lg:gap-6">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
}

function StatCard({ value, label }: Stat) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-[12px] border border-gray-200 bg-white p-4 shadow-[0px_2px_4px_rgba(0,0,0,0.02)] md:w-[376px] md:gap-1.5 md:rounded-card md:p-5 md:shadow-[0px_4px_6px_rgba(0,0,0,0.06)] lg:w-auto lg:flex-1 lg:gap-2 lg:p-6">
      <p className="font-marketing text-[24px] font-bold leading-normal text-primary md:text-[28px] lg:text-[32px]">
        {value}
      </p>
      <p className="text-[12px] font-medium leading-normal text-text-secondary md:text-[13px] lg:text-[14px]">
        {label}
      </p>
    </div>
  );
}
