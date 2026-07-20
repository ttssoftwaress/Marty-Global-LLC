import type { ReactNode } from 'react';

import { EyeIcon, GlobeIcon, ShieldIcon, UserIcon } from '../icons';

/*
 * What We Stand For — the fourth section of the About page. A header over a
 * grid of value cards. Sits on a Gray-50 surface. Three breakpoints per Figma:
 *   - mobile (<768px):  px-4 py-10, 28px section gap; header left-aligned with
 *     10px gap (26px heading, 14px/20 lead); grid is 1 column, 12px gap; cards
 *     have 20px padding, 12px radius, sm shadow, 12px gap; 18px title, 13px/20
 *     body.
 *   - tablet (md, 768px): px-10 py-20, 48px section gap; header center-aligned
 *     with 16px gap (32px/40 heading, 16px/24 lead); grid is 2 columns, 16px
 *     gap; cards have 20px padding, 12px radius, Gray-200 border, 16px gap;
 *     18px title, 13px/20 body.
 *   - desktop (lg, 1024px): px-20 py-24, 48px section gap; header center-aligned
 *     with 12px gap (40px heading, 16px lead capped at 600px); grid is 4 columns
 *     (single row), 24px gap; cards have 24px padding, 16px radius, sm shadow,
 *     16px gap; 20px title, 14px/22 body.
 * The heading uses the marketing (Poppins) face in primary text; the lead and
 * card body are secondary text. Each card leads with a Lucide glyph in a
 * primary-light rounded box, drawn in brand primary.
 */

type ValueIcon = (props: { className?: string }) => ReactNode;

const VALUES: { icon: ValueIcon; title: string; body: string }[] = [
  {
    icon: EyeIcon,
    title: 'Absolute Transparency',
    body: 'No surprise fees, no hidden state-filing markups. You see exactly what is being filed and what it costs from day one.',
  },
  {
    icon: ShieldIcon,
    title: 'Security & Compliance',
    body: 'Data handling and corporate structures aligned directly with modern security frameworks and strict KYC regulations.',
  },
  {
    icon: GlobeIcon,
    title: 'Global Expertise',
    body: 'Deep, updated, hands-on knowledge regarding corporate laws across the US, United Kingdom, Canada, and Europe.',
  },
  {
    icon: UserIcon,
    title: 'Client-First Support',
    body: 'Fast, human communication from actual legal operators. No looping bot circles when your company status is on the line.',
  },
];

export function ValuesSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-gray-50 px-4 py-10 md:gap-12 md:px-10 md:py-20 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-start gap-2.5 md:items-center md:gap-4 md:text-center lg:gap-3">
        <h2 className="w-full font-marketing text-[26px] font-bold leading-normal text-text md:text-[32px] md:leading-10 lg:text-[40px]">
          What We Stand For
        </h2>
        <p className="w-full text-[14px] font-normal leading-5 text-text-secondary md:text-[16px] md:leading-6 lg:w-[600px]">
          The operating principles that guide our product engineering, our
          partner networks, and our customer relations every single day.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6">
        {VALUES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex flex-col items-start gap-3 rounded-xl bg-white p-5 shadow-sm-elevation md:gap-4 md:border md:border-gray-200 lg:gap-4 lg:rounded-card lg:border-0 lg:p-6"
          >
            <div className="flex items-start rounded-input bg-primary-light p-3">
              <Icon className="size-6 text-primary" />
            </div>
            <h3 className="font-marketing text-[18px] font-semibold leading-normal text-text lg:text-[20px]">
              {title}
            </h3>
            <p className="text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
