import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/*
 * Summary card — the shared shell behind "Billing summary" and "Virtual mail
 * rooms". A titled card with a link and a set of label/value entries.
 *
 * The entries change orientation by breakpoint: stacked rows with hairline
 * dividers on mobile and desktop, three side-by-side columns on tablet. Both
 * cards do this identically in the Figma links, so the behaviour lives here
 * once instead of being written twice.
 */

export type SummaryEntry = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

type SummaryCardProps = {
  title: string;
  linkLabel: string;
  to: string;
  entries: SummaryEntry[];
};

export function SummaryCard({ title, linkLabel, to, entries }: SummaryCardProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body-lg font-semibold text-text lg:text-h6">{title}</h2>
        <Link
          to={to}
          className="shrink-0 text-small font-medium text-primary transition-colors hover:text-primary-hover"
        >
          {linkLabel}
        </Link>
      </div>

      <dl className="flex w-full flex-col md:flex-row md:gap-4 lg:flex-col lg:gap-0">
        {entries.map(({ label, value, valueClassName }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-gray-200 py-3 last:border-b-0 md:min-w-0 md:flex-1 md:flex-col md:items-start md:gap-1 md:border-b-0 md:py-0 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:border-b lg:py-3 lg:last:border-b-0"
          >
            <dt className="text-body text-gray-500 md:text-small lg:text-body">
              {label}
            </dt>
            <dd
              className={`text-body font-semibold md:text-body-lg md:font-bold lg:text-body-lg lg:font-semibold ${valueClassName ?? 'text-text'}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
