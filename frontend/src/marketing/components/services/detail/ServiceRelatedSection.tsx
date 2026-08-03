import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/*
 * "Often ordered with" — the sibling services at the foot of a detail page.
 * Each card links to that service's own detail page; a service with no page yet
 * points at `/services` until one lands.
 *
 * Three breakpoints: one column on mobile (px-5 py-10), 2-up at tablet
 * (px-10 py-14), 3-up at desktop (px-20 py-20).
 */

export type RelatedService = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  description: string;
  to: string;
  /** Label for the card's own link — "Explore services" when `to` is the list. */
  linkLabel: string;
};

type ServiceRelatedSectionProps = {
  heading: string;
  subheading: string;
  services: RelatedService[];
  tone?: 'white' | 'gray';
};

export function ServiceRelatedSection({
  heading,
  subheading,
  services,
  tone = 'gray',
}: ServiceRelatedSectionProps) {
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

      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {services.map((service) => (
          <RelatedCard key={service.title} {...service} />
        ))}
      </div>
    </section>
  );
}

function RelatedCard({
  Icon,
  title,
  description,
  to,
  linkLabel,
}: RelatedService) {
  return (
    <Link
      to={to}
      className="hover-lift group flex h-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.05)] lg:gap-5 lg:p-7"
    >
      <div className="flex size-12 items-center justify-center rounded-[10px] bg-primary-light transition-colors group-hover:bg-soft-pink lg:size-14 lg:rounded-card">
        <Icon className="size-6 text-primary transition-colors group-hover:text-accent lg:size-7" />
      </div>

      <div className="flex w-full flex-1 flex-col items-start gap-2">
        <h3 className="w-full font-marketing text-[18px] font-semibold leading-[1.2] text-text lg:text-[20px]">
          {title}
        </h3>
        <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
          {description}
        </p>
      </div>

      <span className="text-[13px] font-semibold text-primary transition-colors group-hover:text-primary-hover lg:text-[14px]">
        {linkLabel}{' '}
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-150 ease-out group-hover:translate-x-1"
        >
          →
        </span>
      </span>
    </Link>
  );
}
