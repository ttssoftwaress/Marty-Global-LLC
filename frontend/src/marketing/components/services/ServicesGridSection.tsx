import type { ReactNode } from 'react';

import {
  BuildingIcon,
  CheckIcon,
  MailOpenIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
} from '../icons';

/*
 * Services grid — the second section of the Services page. A 2×2 grid of
 * detailed service cards over a Gray-50 field, closed by a registered-agent
 * note. Three breakpoints per Figma:
 *   - mobile (<768px):  px-5 py-8, single stacked column, 12px-radius cards,
 *     18px titles, 13px body; e-commerce platforms render as wrapped badges.
 *   - tablet (md, 768px): px-10 py-12, 2-up grid, 24px card padding, 20px
 *     titles; platforms render inline ("Supported:").
 *   - desktop (lg, 1024px): p-20, 2-up grid with 32/48px gaps, 32px card
 *     padding, 24px titles, 22px body; buttons shrink to content width and the
 *     note centers on one line.
 * Each card scales its icon tile, type, bullet spacing, and button across the
 * breakpoints.
 */

type Service = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  description: string;
  bullets: string[];
  buttonLabel: string;
  href: string;
  platforms?: string[];
};

const SERVICES: Service[] = [
  {
    Icon: BuildingIcon,
    title: 'Company Formation — LLC, INC & LTD',
    description:
      'Register your business entity in any supported jurisdiction. We handle LLC formation in the US, LTD registration in the UK, Canada, and Europe, and INC structures where needed.',
    bullets: [
      'Full entity registration & filing with local state/national registry',
      'Includes 1 year of professional Registered Agent service',
      'Custom operating agreements & standard corporate formation documents',
      'Complete federal EIN / Tax ID application support & guidance',
    ],
    buttonLabel: 'View Formation Details →',
    href: '/services/formation',
  },
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'Get a professional business mailing address in your chosen jurisdiction. We receive, scan, and forward your mail so you can manage correspondence from anywhere in the world.',
    bullets: [
      'Real physical street addresses in premium business corridors (US, UK, CA, EU)',
      'Secure, high-resolution mail scanning & automatic digital forwarding',
      'Package receiving, sorting, and worldwide physical forwarding',
      'Fulfill legal requirement of native address for your registered entity',
    ],
    buttonLabel: 'View Mail Room Details →',
    href: '/services/mailroom',
  },
  {
    Icon: BuildingIcon,
    title: 'Bank Account Opening',
    description:
      'Navigate the often complex process of opening a business bank account as a non-resident or newly formed entity. We guide you through applications with partner banks across all regions.',
    bullets: [
      'Tailored options for US, UK, Canadian & European business accounts',
      'Step-by-step guided application and compliance onboarding check',
      'Explicit support for non-resident and international digital founders',
      'Global multi-currency accounts with top-tier platform partners',
    ],
    buttonLabel: 'View Banking Details →',
    href: '/services/banking',
  },
  {
    Icon: ShoppingCartIcon,
    title: 'E-Commerce Account Setup',
    description:
      'Get approved to sell on major global marketplaces. We help international founders get verified and set up seller accounts on platforms that require a properly registered local entity.',
    bullets: [
      'Seamless seller account setup on Amazon, eBay, Walmart, and Alibaba',
      'Assistance navigating strict platform identity & address verification',
      'Localized compliance guidance tailored to your business model',
      'Direct technical ties into your corporate formation, mailroom & banking',
    ],
    buttonLabel: 'View E-Commerce Details →',
    href: '/services/ecommerce',
    platforms: ['amazon', 'ebay', 'Walmart', 'Alibaba'],
  },
];

export function ServicesGridSection() {
  return (
    <section className="flex w-full flex-col items-start gap-6 bg-gray-50 px-5 py-8 md:gap-8 md:px-10 md:py-12 lg:gap-12 lg:p-20">
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:gap-x-8 lg:gap-y-12">
        {SERVICES.map((service) => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>

      <div className="flex w-full items-start gap-2 py-2 md:items-center md:justify-center md:py-0">
        <ShieldCheckIcon className="size-4 shrink-0 text-accent" />
        <p className="flex-1 text-[12px] font-medium leading-4 text-text-secondary md:flex-none md:text-[13px] md:leading-normal lg:text-[14px]">
          We also provide Registered Agent services in all 50 states — included
          with every LLC formation package.
        </p>
      </div>
    </section>
  );
}

function ServiceCard({
  Icon,
  title,
  description,
  bullets,
  buttonLabel,
  href,
  platforms,
}: Service) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-[12px] border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.05)] lg:gap-6 lg:rounded-card lg:p-8">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-primary-light lg:size-14">
        <Icon className="size-6 text-primary lg:size-7" />
      </div>

      <div className="flex w-full flex-col items-start gap-2 lg:gap-3">
        <h3 className="w-full font-marketing text-[18px] font-bold leading-normal text-text md:text-[20px] lg:text-[24px]">
          {title}
        </h3>
        <p className="w-full text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] lg:leading-[22px]">
          {description}
        </p>
      </div>

      <ul className="flex w-full flex-col items-start gap-2 lg:gap-2.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex w-full items-start gap-2 lg:items-center">
            <CheckIcon className="size-4 shrink-0 text-success" />
            <span className="flex-1 text-[13px] font-normal leading-[18px] text-text-secondary lg:leading-normal">
              {bullet}
            </span>
          </li>
        ))}
      </ul>

      {platforms ? <PlatformLogos platforms={platforms} /> : null}

      <div className="flex w-full items-start pt-0 lg:pt-3">
        <a
          href={href}
          className="flex w-full items-center justify-center rounded-[8px] border-2 border-primary bg-white px-4 py-3 text-[14px] font-semibold text-primary transition-colors hover:bg-primary-light md:rounded-input md:px-5 lg:w-auto lg:px-6 lg:py-3.5 lg:text-[16px]"
        >
          {buttonLabel}
        </a>
      </div>
    </div>
  );
}

/*
 * Platform strip — inline on md/lg ("Supported:" + logos in one row), stacked
 * with bordered badges on mobile. Both come from the same platform list.
 */
function PlatformLogos({ platforms }: { platforms: string[] }) {
  return (
    <div className="flex w-full flex-col items-start gap-2 pt-0 md:flex-row md:items-center md:gap-3 md:pt-2 lg:gap-4">
      <p className="shrink-0 text-[10px] font-semibold uppercase leading-normal text-gray-400 lg:text-[11px]">
        <span className="md:hidden lg:inline">Supported Platforms:</span>
        <span className="hidden md:inline lg:hidden">Supported:</span>
      </p>
      <div className="flex flex-wrap items-start gap-2 md:items-center md:gap-2 lg:gap-3">
        {platforms.map((platform) => (
          <span
            key={platform}
            className="rounded-[6px] border border-gray-200 bg-gray-50 px-2 py-1 font-marketing text-[11px] font-bold leading-normal text-gray-500 md:border-0 md:bg-transparent md:p-0 md:text-[11px] md:text-gray-400 lg:text-[12px]"
          >
            {platform}
          </span>
        ))}
      </div>
    </div>
  );
}
