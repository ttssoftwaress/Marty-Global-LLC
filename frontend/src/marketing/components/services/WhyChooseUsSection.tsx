import type { ReactNode } from 'react';

import { GlobeIcon, ShuffleIcon, UserIcon, ZapIcon } from '../icons';

/*
 * Why Choose Us — the third section of the Services page. A centered heading
 * over a row of four value props, each a pill-framed icon above a title and
 * blurb. Three breakpoints per Figma:
 *   - mobile (<768px):  px-5 py-10, 32px gap, left-aligned 24px/1.25 heading,
 *     14px body; props stack in a single column with 40px icon tiles.
 *   - tablet (md, 768px): px-10 py-16, 40px gap, centered 32px/1.2 heading,
 *     15px body; props render as a 2×2 grid with 44px icon tiles.
 *   - desktop (lg, 1024px): px-20 py-24, 56px gap, centered 40px/1.2 heading,
 *     16px body capped at 800px wide; props render as one 4-up row with 48px
 *     icon tiles and 32px gaps.
 * Each prop scales its icon tile, icon, title (16→18px), and gap across the
 * breakpoints.
 */

type ValueProp = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  description: string;
};

const VALUE_PROPS: ValueProp[] = [
  {
    Icon: ZapIcon,
    title: 'Faster Setup',
    description:
      'One unified application feeds directly from formation to corporate bank accounts and mail setup without repeating data.',
  },
  {
    Icon: UserIcon,
    title: 'Single Point of Contact',
    description:
      'Say goodbye to multiple vendors. Our dedicated account managers handle your entire business compliance stack.',
  },
  {
    Icon: GlobeIcon,
    title: 'Cross-Border Expertise',
    description:
      'Get regulatory safety. We bridge compliance rules and taxation standards across 4 separate regions seamlessly.',
  },
  {
    Icon: ShuffleIcon,
    title: 'Seamless Integration',
    description:
      'Your corporate entity, virtual mailbox, banking routes, and merchant stores operate as one connected system.',
  },
];

export function WhyChooseUsSection() {
  return (
    <section className="flex w-full flex-col items-start gap-8 bg-white px-5 py-10 md:items-center md:gap-10 md:px-10 md:py-16 lg:gap-14 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-start gap-3 md:items-center md:text-center lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          Why Choose One Partner for Everything
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          Save time, eliminate regulatory errors, and cut cost by organizing
          your entire corporate presence under Marty Global&apos;s trusted
          corporate infrastructure.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {VALUE_PROPS.map((prop) => (
          <ValuePropItem key={prop.title} {...prop} />
        ))}
      </div>
    </section>
  );
}

function ValuePropItem({ Icon, title, description }: ValueProp) {
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
