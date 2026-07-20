import type { ReactNode } from 'react';

import { ClockIcon, MailIcon, PhoneIcon } from '../icons';

/*
 * Contact page — main content section. Sits below the hero. A two-column
 * layout: a left intro column (heading, supportive copy, and the direct
 * contact details as icon-tile rows, plus quick links) and a right message
 * card. On desktop they sit side by side; on tablet and mobile they stack with
 * the form leading. Three breakpoints:
 *   - mobile (<768px):  px-4 py-12, stacked, 32px gap. Intro copy full-width;
 *     detail rows with 40px icon tiles; form card p-5 with 44px inputs.
 *   - tablet (md, 768px): px-10 py-16, stacked, 40px gap, centered content
 *     capped at a readable width; form card p-8 with 48px inputs.
 *   - desktop (lg, 1024px): px-20 py-20, two columns — intro 1fr, form 480px —
 *     with 64px gutter; the form card is elevated white on the gray page.
 * The mail, phone, and clock glyphs reuse the shared marketing icon set.
 * Fields are static placeholders — this is presentational; the wired lead form
 * lands later against the backend `leads` module.
 */

const DETAILS = [
  {
    Icon: MailIcon,
    label: 'Email us',
    value: 'hello@martgloballlc.com',
    href: 'mailto:hello@martgloballlc.com',
  },
  {
    Icon: PhoneIcon,
    label: 'Call us',
    value: '+1 (555) 123-4567',
    href: 'tel:+15551234567',
  },
  {
    Icon: ClockIcon,
    label: 'Office hours',
    value: 'Mon–Fri, 9am–6pm (Global Support)',
    href: undefined,
  },
];

export function ContactFormSection() {
  return (
    <section className="w-full bg-gray-50 px-4 py-12 md:px-10 md:py-16 lg:px-20 lg:py-20">
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-stretch gap-8 md:gap-10 lg:max-w-[1200px] lg:flex-row lg:items-start lg:gap-16">
        <IntroColumn />
        <FormCard />
      </div>
    </section>
  );
}

function IntroColumn() {
  return (
    <div className="flex w-full flex-col items-start gap-6 md:gap-8 lg:flex-1 lg:pt-2">
      <div className="flex flex-col items-start gap-3 md:gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-accent">
          Contact Us
        </span>
        <h2 className="font-marketing text-[28px] font-bold leading-[1.2] text-text md:text-[36px] lg:text-[40px]">
          Still Have Questions?
        </h2>
        <p className="max-w-[460px] text-[14px] font-normal leading-[22px] text-text-secondary md:text-[16px] md:leading-[26px]">
          Our team is here to help — send us a message and we&apos;ll get back
          to you within 24 hours. Prefer to reach us directly? Use any of the
          channels below.
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-3 md:gap-4">
        {DETAILS.map(({ Icon, label, value, href }) => (
          <DetailRow
            key={label}
            Icon={Icon}
            label={label}
            value={value}
            href={href}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1 text-[14px] font-semibold text-primary">
        <a href="#" className="inline-flex items-center gap-1 hover:underline">
          Browse Services →
        </a>
        <a href="#" className="inline-flex items-center gap-1 hover:underline">
          View FAQ →
        </a>
      </div>
    </div>
  );
}

type DetailRowProps = {
  Icon: (props: { className?: string }) => ReactNode;
  label: string;
  value: string;
  href?: string;
};

function DetailRow({ Icon, label, value, href }: DetailRowProps) {
  const content = (
    <div className="flex w-full items-center gap-4 rounded-card border border-gray-200 bg-white p-3 shadow-sm-elevation transition-shadow group-hover:shadow-md-elevation md:p-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-primary md:size-12">
        <Icon className="size-5" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[12px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </span>
        <span className="truncate text-[14px] font-semibold text-text md:text-[15px]">
          {value}
        </span>
      </div>
    </div>
  );

  if (!href) {
    return <div className="group w-full">{content}</div>;
  }

  return (
    <a href={href} className="group w-full">
      {content}
    </a>
  );
}

function FormCard() {
  return (
    <div className="flex w-full flex-col items-start gap-5 rounded-card border border-gray-200 bg-white p-5 shadow-lg-elevation md:gap-6 md:p-8 lg:w-[480px] lg:shrink-0">
      <div className="flex flex-col items-start gap-1.5">
        <h3 className="text-[18px] font-semibold text-text md:text-[20px]">
          Send us a message
        </h3>
        <p className="text-[13px] font-normal leading-[18px] text-text-secondary md:text-[14px] md:leading-normal">
          Fill in the form and our team will be in touch shortly.
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-4 md:gap-5">
        <CompactField label="Your Name" placeholder="Jane Cooper" />
        <CompactField label="Email" placeholder="jane@example.com" />
        <div className="flex w-full flex-col items-start gap-1.5 md:gap-2">
          <label className="text-[13px] font-medium text-text md:text-[14px]">
            Message
          </label>
          <div className="flex h-28 w-full flex-col items-start rounded-[10px] border border-gray-300 bg-white p-4 md:h-32">
            <span className="text-[13px] font-normal text-gray-400 md:text-[14px]">
              Tell us how we can help...
            </span>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center rounded-control bg-primary px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover md:py-3.5 md:text-[16px]"
        >
          Send Message
        </button>
      </div>
    </div>
  );
}

type CompactFieldProps = {
  label: string;
  placeholder: string;
};

function CompactField({ label, placeholder }: CompactFieldProps) {
  return (
    <div className="flex w-full flex-col items-start gap-1.5 md:gap-2">
      <label className="text-[13px] font-medium text-text md:text-[14px]">
        {label}
      </label>
      <div className="flex h-11 w-full items-center rounded-[10px] border border-gray-300 bg-white px-4 md:h-12">
        <span className="text-[13px] font-normal text-gray-400 md:text-[14px]">
          {placeholder}
        </span>
      </div>
    </div>
  );
}
