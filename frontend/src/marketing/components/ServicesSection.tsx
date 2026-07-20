import type { ReactNode } from 'react';

import {
  BriefcaseIcon,
  MailOpenIcon,
  PiggyBankIcon,
  ShieldCheckIcon,
} from './icons';

/*
 * Services — the second section of the home page. Three breakpoints per Figma:
 *   - mobile (<768px):  single stacked column of full-width cards.
 *   - tablet (md, 768px): still a single stacked column, larger type/padding.
 *   - desktop (lg, 1024px): three equal cards in a row; the header is capped at
 *     800px and centered.
 * Each card scales its icon tile, title, body, and link across the breakpoints.
 */

type Service = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  description: string;
  linkLabel: string;
  href: string;
};

const SERVICES: Service[] = [
  {
    Icon: BriefcaseIcon,
    title: 'LLC Formation & Registration',
    description:
      'Form your business fast across United States, United Kingdom, Canada, or European jurisdictions. Complete with standard Articles of Incorporation and immediate processing.',
    linkLabel: 'Learn more about formation',
    href: '/services/formation',
  },
  {
    Icon: PiggyBankIcon,
    title: 'Bank Account Opening',
    description:
      'Fast-track your corporate business bank account opening. Seamless options for residents and non-residents globally with leading financial partners.',
    linkLabel: 'Learn more about banking',
    href: '/services/banking',
  },
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'Secure a prestigious commercial street address. Keep your remote business private with high-resolution digital mail scanning and forwarding options.',
    linkLabel: 'Learn more about mailroom',
    href: '/services/mailroom',
  },
];

export function ServicesSection() {
  return (
    <section className="flex w-full flex-col items-center gap-10 bg-white px-4 py-16 md:gap-12 md:px-10 md:py-20 lg:gap-16 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-center gap-3 text-center md:gap-4 lg:w-[800px]">
        <h2 className="w-full font-marketing text-[28px] font-bold leading-[1.2] text-text md:text-[32px] lg:text-[40px]">
          Everything You Need to Start and Run Your Business
        </h2>
        <p className="w-full text-[14px] leading-[22px] text-text-secondary md:text-[15px] lg:text-[16px]">
          Select the services essential for your expansion. From structural
          formation to corporate banking setups, we align with international
          standards.
        </p>
      </div>

      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {SERVICES.map((service) => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-2 md:gap-2">
        <ShieldCheckIcon className="size-3.5 shrink-0 text-accent md:size-4" />
        <p className="text-[12px] font-medium text-text-secondary md:text-[14px]">
          Plus: Registered Agent services available in all US states
        </p>
      </div>
    </section>
  );
}

function ServiceCard({ Icon, title, description, linkLabel, href }: Service) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-6 shadow-[0px_8px_12px_rgba(3,18,109,0.04)] md:gap-5 md:p-7 lg:min-w-0 lg:flex-1 lg:gap-6 lg:p-8">
      <div className="flex size-12 items-center justify-center rounded-[10px] bg-primary-light md:size-[52px] md:rounded-card lg:size-14">
        <Icon className="size-6 text-primary md:size-[26px] lg:size-7" />
      </div>

      <div className="flex w-full flex-col items-start gap-2">
        <h3 className="w-full font-marketing text-[20px] font-semibold leading-[1.2] text-text lg:text-[24px]">
          {title}
        </h3>
        <p className="w-full text-[13px] leading-5 text-text-secondary md:text-[14px] md:leading-[22px]">
          {description}
        </p>
      </div>

      <a
        href={href}
        className="text-[13px] font-semibold text-primary transition-colors hover:text-primary-hover md:text-[14px]"
      >
        {linkLabel} →
      </a>
    </div>
  );
}
