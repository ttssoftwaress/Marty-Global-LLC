import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/*
 * The numbered process cards on a per-service detail page — how the service
 * runs, in the order it runs. Card treatment follows the How It Works page's
 * step cards, so the same process reads the same way on both. Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, one column, 36px number bubble top-right.
 *   - tablet (md, 768px): px-10 py-14, 2-up grid, 48px bubble on the left.
 *   - desktop (lg, 1024px): px-20 py-20, `columns` across, 56px bubble on top.
 * `columns` is 3 or 4 — three reads better for five steps (the last row is not
 * a lonely single card), four for a four-step lifecycle.
 */

export type ServiceStep = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  description: string;
};

type ServiceStepGridProps = {
  heading: string;
  subheading: string;
  steps: ServiceStep[];
  columns?: 3 | 4;
  tone?: 'white' | 'gray';
  footerLink?: { to: string; label: string };
};

export function ServiceStepGrid({
  heading,
  subheading,
  steps,
  columns = 3,
  tone = 'white',
  footerLink,
}: ServiceStepGridProps) {
  return (
    <section
      className={`flex w-full flex-col items-start gap-7 px-5 py-10 md:gap-9 md:px-10 md:py-14 lg:gap-12 lg:px-20 lg:py-20 ${
        tone === 'gray' ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          {heading}
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          {subheading}
        </p>
      </div>

      <div
        className={`grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 ${
          columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        {steps.map((step, index) => (
          <StepCard key={step.title} number={index + 1} {...step} />
        ))}
      </div>

      {footerLink && (
        <Link
          to={footerLink.to}
          className="text-[14px] font-semibold text-primary hover:underline lg:text-[15px]"
        >
          {footerLink.label} &rarr;
        </Link>
      )}
    </section>
  );
}

function StepCard({
  number,
  Icon,
  title,
  description,
}: ServiceStep & { number: number }) {
  return (
    <article className="relative flex h-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_2px_5px_rgba(0,0,0,0.05)] md:flex-row md:items-start md:gap-4 lg:flex-col lg:gap-3">
      <div className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-pill bg-primary text-[14px] font-bold text-white md:static md:right-auto md:top-auto md:size-12 md:text-[18px] lg:size-14 lg:text-[20px]">
        <span className="font-marketing">{number}</span>
      </div>

      <div className="flex w-full flex-1 flex-col gap-1.5 md:w-auto md:gap-2 lg:gap-2.5">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-3">
          <div className="flex shrink-0 items-start rounded-lg bg-primary-light p-2">
            <Icon className="size-6 text-primary md:size-5" />
          </div>
          <h3 className="w-full text-[18px] font-semibold leading-normal text-text md:flex-1 md:text-[16px] lg:text-[18px]">
            {title}
          </h3>
        </div>
        <p className="w-full text-[13px] font-normal leading-[1.45] text-text-secondary md:leading-5 lg:text-[14px] lg:leading-[22px]">
          {description}
        </p>
      </div>
    </article>
  );
}
