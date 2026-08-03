import type { ReactNode } from 'react';

/*
 * "What this service includes" — the deliverables grid on a per-service detail
 * page. A section heading over icon-tile items, the same treatment as the
 * Services page's value props. Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column, 40px icon tiles.
 *   - tablet (md, 768px): px-10 py-16, 2-up grid, 44px tiles.
 *   - desktop (lg, 1024px): px-20 py-20, 3-up grid, 48px tiles.
 * `tone` picks the surface so consecutive sections on a page alternate.
 */

export type ServiceFeature = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  description: string;
};

type ServiceFeatureGridProps = {
  heading: string;
  subheading: string;
  features: ServiceFeature[];
  tone?: 'white' | 'gray';
};

export function ServiceFeatureGrid({
  heading,
  subheading,
  features,
  tone = 'white',
}: ServiceFeatureGridProps) {
  return (
    <section
      className={`flex w-full flex-col items-start gap-7 px-5 py-10 md:gap-10 md:px-10 md:py-16 lg:gap-12 lg:px-20 lg:py-20 ${
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

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {features.map((feature) => (
          <FeatureItem key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}

function FeatureItem({ Icon, title, description }: ServiceFeature) {
  return (
    <div className="flex flex-col items-start gap-3 lg:gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light md:size-11 lg:size-12">
        <Icon className="size-[18px] text-primary lg:size-5" />
      </div>
      <h3 className="w-full text-[16px] font-semibold leading-normal text-text lg:text-[18px]">
        {title}
      </h3>
      <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
        {description}
      </p>
    </div>
  );
}
