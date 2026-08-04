import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  CpuIcon,
  LandmarkIcon,
  MailOpenIcon,
  MonitorIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
} from '../icons';
import { ServiceCoverageDisclosure } from './detail/ServiceCoverageDisclosure';

/*
 * The service catalogue on `/services` — every service Marty Global sells, in
 * three groups, each card linking to that service's detail page.
 *
 * Rebuilt (August 2026). It previously showed four services as tall marketing
 * cards with a paragraph and four long bullets each, while three more services
 * had pages but appeared nowhere on this page. The rewrite:
 *   - lists all SEVEN, grouped by what stage of a business they belong to, so
 *     seven cards read as a catalogue rather than a wall;
 *   - trades the paragraph for a one-line tagline plus a meta row (timeline,
 *     and what it is bundled with), which is the information a visitor is
 *     actually comparing on;
 *   - shortens the bullets to three and drops the type size, so a card is about
 *     half its old height;
 *   - puts the coverage list behind a disclosure on the three services whose
 *     answer is geographic — states and countries only, never street addresses.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-8, one column.
 *   - tablet (md, 768px): px-10 py-12, 2-up.
 *   - desktop (lg, 1024px): px-20 py-16, 3-up, so the groups read 3 / 2 / 2.
 */

type Service = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  tagline: string;
  timeline: string;
  /** Second meta line — what it is included with, or what it needs. */
  note?: string;
  bullets: string[];
  to: string;
  /** Renders the country/state disclosure — only the geography-bound services. */
  coverage?: boolean;
};

type ServiceGroup = {
  title: string;
  description: string;
  services: Service[];
};

const GROUPS: ServiceGroup[] = [
  {
    title: 'Set up the company',
    description:
      'The entity, the contact the state serves, and an address that receives your post.',
    services: [
      {
        Icon: BriefcaseIcon,
        title: 'Company Formation',
        tagline:
          'LLC and INC in the United States, LTD in the UK, Canada, and Europe — filed with the registry.',
        timeline: 'Timeline varies by jurisdiction',
        note: 'Includes 1 year of Registered Agent (US)',
        bullets: [
          'Entity registered and filed for you',
          'Operating agreement, bylaws & certificate',
          'EIN / Tax ID application support',
        ],
        to: '/services/formation',
        coverage: true,
      },
      {
        Icon: ShieldCheckIcon,
        title: 'Registered Agent',
        tagline:
          'We act as your registered agent and registered office, and keep the appointment current.',
        timeline: 'Filed in 1–3 business days',
        note: 'Renews annually · included with US formation',
        bullets: [
          'Our address on the public record',
          'Legal notices scanned the same day',
          'Renewal reminders before it lapses',
        ],
        to: '/services/registered-agent',
        coverage: true,
      },
      {
        Icon: MailOpenIcon,
        title: 'Virtual Mail Room',
        tagline:
          'A real commercial street address that receives, scans, and forwards your post.',
        timeline: 'Room live in 1–2 business days',
        note: 'Annual subscription per address',
        bullets: [
          'High-resolution scanning to your dashboard',
          'Worldwide forwarding with tracking',
          'Secure shredding on request',
        ],
        to: '/services/mailroom',
        coverage: true,
      },
    ],
  },
  {
    title: 'Start operating',
    description:
      'Where the money arrives, and where the customers are. Both are granted by someone else — we prepare the application.',
    services: [
      {
        Icon: LandmarkIcon,
        title: 'Bank Account Opening',
        tagline:
          'Guided business account applications for newly formed and non-resident-owned companies.',
        timeline: 'Decision timeline set by the bank',
        note: 'Needs a formed company & tax number',
        bullets: [
          'Partners matched to your entity & model',
          'Application prepared and compliance-checked',
          'Multi-currency options where supported',
        ],
        to: '/services/banking',
      },
      {
        Icon: ShoppingCartIcon,
        title: 'E-Commerce Account Setup',
        tagline:
          'Business seller accounts on Amazon, eBay, Walmart, and Alibaba, registered in your company’s name.',
        timeline: 'Approval timeline set by the platform',
        note: 'Needs a company, address & bank account',
        bullets: [
          'Seller registration completed for you',
          'Identity & address verification prepared',
          'Entity, address and bank details aligned',
        ],
        to: '/services/ecommerce',
      },
    ],
  },
  {
    title: 'Run it from anywhere',
    description:
      'The machine you work from and the site your customers find — both delivered and looked after.',
    services: [
      {
        Icon: CpuIcon,
        title: 'Remote Desktop (RDP)',
        tagline:
          'A dedicated Windows or Linux desktop in the cloud, online around the clock.',
        timeline: 'Handed over within 24 hours',
        note: 'Monthly, quarterly or annual',
        bullets: [
          'Dedicated vCPU, RAM & SSD — never shared',
          'Six data centres across the US, UK, EU & Asia',
          'Upgrades, resets & installs on request',
        ],
        to: '/services/remote-desktop',
      },
      {
        Icon: MonitorIcon,
        title: 'Website Design & Development',
        tagline:
          'A brochure site, an online store, a landing page, or a custom build — designed, built, and hosted.',
        timeline: 'Delivered in 2–4 weeks',
        note: 'Domain, hosting & SSL handled',
        bullets: [
          'Five site types, on the right platform',
          'Content written for you, or provide your own',
          'Updates & renewals after launch',
        ],
        to: '/services/website',
      },
    ],
  },
];

export function ServicesGridSection() {
  return (
    <section className="flex w-full flex-col items-start gap-8 bg-gray-50 px-5 py-8 md:gap-10 md:px-10 md:py-12 lg:gap-14 lg:px-20 lg:py-16">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex w-full flex-col items-start gap-4 lg:gap-6">
          <div className="flex w-full flex-col items-start gap-1 lg:gap-1.5">
            <h2 className="font-marketing text-[18px] font-bold leading-normal text-primary md:text-[20px] lg:text-[22px]">
              {group.title}
            </h2>
            <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:max-w-[720px] lg:text-[14px]">
              {group.description}
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {group.services.map((service) => (
              <ServiceCard key={service.title} {...service} />
            ))}
          </div>
        </div>
      ))}

      <p className="w-full text-[12px] font-medium leading-[18px] text-text-secondary md:text-center md:text-[13px] md:leading-normal">
        Most customers order two or three of these together — the answers you
        give once carry across every service in the same application.
      </p>
    </section>
  );
}

function ServiceCard({
  Icon,
  title,
  tagline,
  timeline,
  note,
  bullets,
  to,
  coverage,
}: Service) {
  return (
    <article className="flex h-full flex-col items-start gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-[0px_2px_6px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0px_8px_16px_rgba(3,18,109,0.08)] lg:gap-4 lg:p-5">
      <div className="flex w-full items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-light lg:size-11">
          <Icon className="size-5 text-primary" />
        </div>
        <h3 className="flex-1 font-marketing text-[16px] font-bold leading-[1.3] text-text lg:text-[17px]">
          {title}
        </h3>
      </div>

      <p className="w-full text-[13px] font-normal leading-5 text-text-secondary">
        {tagline}
      </p>

      <div className="flex w-full flex-col items-start gap-1.5 rounded-[10px] bg-gray-50 p-2.5">
        <div className="flex w-full items-center gap-1.5">
          <ClockIcon className="size-3.5 shrink-0 text-primary" />
          <span className="flex-1 text-[11px] font-semibold leading-normal text-text lg:text-[12px]">
            {timeline}
          </span>
        </div>
        {note && (
          <div className="flex w-full items-center gap-1.5">
            <CheckIcon className="size-3.5 shrink-0 text-success" />
            <span className="flex-1 text-[11px] font-medium leading-normal text-text-secondary lg:text-[12px]">
              {note}
            </span>
          </div>
        )}
      </div>

      <ul className="flex w-full flex-1 flex-col items-start gap-1.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex w-full items-start gap-2">
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
            <span className="flex-1 text-[12px] font-normal leading-[18px] text-text-secondary lg:text-[13px]">
              {bullet}
            </span>
          </li>
        ))}
      </ul>

      {coverage && <ServiceCoverageDisclosure variant="compact" />}

      <Link
        to={to}
        className="mt-auto flex w-full items-center justify-center rounded-input border-2 border-primary px-4 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary-light lg:text-[14px]"
      >
        View details &rarr;
      </Link>
    </article>
  );
}
