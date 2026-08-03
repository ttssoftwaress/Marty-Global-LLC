import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/*
 * The hero every per-service detail page opens with (`/services/<slug>`).
 * Breadcrumb back to the service list, a primary-light eyebrow pill, the Poppins
 * heading, a secondary subtitle, the page's two CTAs, then a row of quick facts.
 * Three breakpoints, the same scale the Services and How It Works heroes use:
 *   - mobile (<768px):  px-5 py-10, 28px/1.25 heading, 14px body, stacked
 *     full-width buttons, quick facts in a column.
 *   - tablet (md, 768px): px-10 pt-14 pb-12, 36px heading, 15px body, buttons in
 *     a row, quick facts wrap inline.
 *   - desktop (lg, 1024px): px-20 pt-20 pb-16, 48px heading, 16px body capped at
 *     800px, quick facts in one row.
 *
 * The secondary CTA is always "Talk to Our Team" — a visitor who is not ready to
 * apply is ready to ask — so only the primary label varies per service.
 */

export type QuickFact = {
  Icon: (props: { className?: string }) => ReactNode;
  label: string;
};

type ServiceDetailHeroProps = {
  eyebrow: string;
  /** Breadcrumb leaf; the page's own name, usually the same as the eyebrow. */
  breadcrumb: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  quickFacts: QuickFact[];
};

export function ServiceDetailHero({
  eyebrow,
  breadcrumb,
  title,
  subtitle,
  primaryCtaLabel,
  quickFacts,
}: ServiceDetailHeroProps) {
  return (
    <section className="flex w-full flex-col items-start gap-4 bg-white px-5 py-10 md:px-10 md:pb-12 md:pt-14 lg:gap-6 lg:px-20 lg:pb-16 lg:pt-20">
      <nav aria-label="Breadcrumb" className="w-full">
        <ol className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-text-secondary md:text-[13px]">
          <li>
            <Link to="/services" className="transition-colors hover:text-primary">
              Services
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-400">
            /
          </li>
          <li className="font-semibold text-primary" aria-current="page">
            {breadcrumb}
          </li>
        </ol>
      </nav>

      <span className="inline-flex items-center rounded-pill bg-primary-light px-3.5 py-1.5 text-[10px] font-bold uppercase text-primary md:px-4 md:text-[11px]">
        {eyebrow}
      </span>

      <h1 className="w-full font-marketing text-[28px] font-bold leading-[1.25] text-text md:text-[36px] md:leading-[1.2] lg:text-[48px]">
        {title}
      </h1>

      <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:max-w-[800px] lg:text-[16px] lg:leading-[1.6]">
        {subtitle}
      </p>

      <div className="flex w-full flex-col items-stretch gap-3 pt-1 md:w-auto md:flex-row md:items-center md:gap-4">
        <Link
          to="/get-started"
          className="flex items-center justify-center rounded-input bg-primary px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover md:py-3 lg:px-8 lg:text-[16px]"
        >
          {primaryCtaLabel}
        </Link>
        <Link
          to="/contact"
          className="flex items-center justify-center rounded-input border-2 border-primary px-6 py-3.5 text-[15px] font-semibold text-primary transition-colors hover:bg-primary-light md:py-3 lg:px-8 lg:text-[16px]"
        >
          Talk to Our Team
        </Link>
      </div>

      <ul className="flex w-full flex-col items-start gap-2 pt-2 md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2 lg:gap-x-8">
        {quickFacts.map(({ Icon, label }) => (
          <li key={label} className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-accent" />
            <span className="text-[13px] font-medium leading-normal text-text-secondary lg:text-[14px]">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
