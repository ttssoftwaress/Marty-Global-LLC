import type { ReactNode } from 'react';

import {
  BellIcon,
  CheckIcon,
  CreditCardIcon,
  MailIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UserIcon,
  ZapIcon,
} from '../icons';

/*
 * How It Works timeline — the process steps, grouped into two phases. Each phase
 * is a full-width band with a Poppins group title, a secondary subtitle, and a
 * set of numbered step cards. Three breakpoints per Figma:
 *   - mobile (<768px):  px-5 py-12, 24px group gap; cards stack in one column
 *     with the icon tile top-left and a 36px number bubble top-right, the title
 *     below, then a 13px/1.45 blurb.
 *   - tablet (md, 768px): px-10, 24px group gap; cards stack in one column with
 *     a 48px number bubble on the left, an inline icon+title header, then a
 *     13px/20px blurb.
 *   - desktop (lg, 1024px): px-20, 32px group gap; cards render as a 3-up grid
 *     with a 56px number bubble on top, an inline icon+title header, then a
 *     14px/22px blurb.
 * The two bands alternate surface: Phase 1 is white, Phase 2 is gray-50 with a
 * top/bottom hairline on desktop (the surfaces swap on mobile per Figma).
 * Every card scales its bubble (36→48→56px), title (18→16→18px), and gaps
 * across the breakpoints.
 */

type Step = {
  number: number;
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  description: string;
};

type Phase = {
  title: string;
  subtitle: string;
  steps: Step[];
};

const PHASES: Phase[] = [
  {
    title: 'Phase 1: Setup & Order',
    subtitle: 'Initiate your international expansion securely.',
    steps: [
      {
        number: 1,
        Icon: UserIcon,
        title: 'Sign Up',
        description:
          'Create your account and get instant access to your personal Dashboard.',
      },
      {
        number: 2,
        Icon: ShoppingCartIcon,
        title: 'Order Your Services',
        description:
          'Select the services you need - Company Formation, Virtual Mail Room, Bank Account Opening, E-Commerce Account Setup - order one or several at once.',
      },
      {
        number: 3,
        Icon: MailIcon,
        title: 'Submit Application',
        description:
          'Fill out and submit the required details and documents for each service you ordered.',
      },
    ],
  },
  {
    title: 'Phase 2: Fulfillment & Operations',
    subtitle:
      'We manage local regulations and file standard documents flawlessly.',
    steps: [
      {
        number: 4,
        Icon: ShieldCheckIcon,
        title: 'Application Review',
        description:
          'Our team reviews your submission for completeness and accuracy - we will flag anything that needs attention.',
      },
      {
        number: 5,
        Icon: CreditCardIcon,
        title: 'Receive Quote & Payment',
        description:
          'You receive a tailored quote based on your services and region, along with a secure payment link.',
      },
      {
        number: 6,
        Icon: CheckIcon,
        title: 'Complete Payment',
        description:
          'Complete payment through the provided method. No hidden fees, no surprises.',
      },
      {
        number: 7,
        Icon: ZapIcon,
        title: 'Work Begins',
        description:
          'Once payment is confirmed, we begin processing - filing, registration, account setup, everything handled.',
      },
      {
        number: 8,
        Icon: BellIcon,
        title: 'Stay Updated',
        description:
          'Track real-time progress through your Dashboard and receive email notifications until delivery is complete.',
      },
    ],
  },
];

export function HowItWorksTimelineSection() {
  const [setup, fulfillment] = PHASES;

  return (
    <div className="flex w-full flex-col">
      {setup && <PhaseBand phase={setup} tone="setup" />}
      {fulfillment && <PhaseBand phase={fulfillment} tone="fulfillment" />}
    </div>
  );
}

/*
 * A phase band spans the full width and alternates its surface. Phase 1 (setup)
 * is gray-50 on mobile / white on tablet+desktop; Phase 2 (fulfillment) is the
 * inverse and carries the top/bottom hairline — the swap mirrors Figma across
 * breakpoints.
 */
function PhaseBand({
  phase,
  tone,
}: {
  phase: Phase;
  tone: 'setup' | 'fulfillment';
}) {
  const surface =
    tone === 'setup'
      ? 'bg-gray-50 md:bg-white'
      : 'border-y border-gray-200 bg-white md:bg-gray-50';

  return (
    <section
      className={`flex w-full flex-col items-start gap-6 px-5 py-12 md:px-10 lg:gap-8 lg:px-20 ${
        tone === 'setup'
          ? 'md:pb-10 md:pt-12 lg:pb-12 lg:pt-16'
          : 'lg:pb-20 lg:pt-12'
      } ${surface}`}
    >
      <div className="flex w-full flex-col items-start gap-1.5 lg:gap-2">
        <h2 className="w-full font-marketing text-[20px] font-bold leading-normal text-primary md:text-[22px] lg:text-[24px]">
          {phase.title}
        </h2>
        <p className="w-full text-[13px] font-normal leading-normal text-text-secondary lg:text-[14px]">
          {phase.subtitle}
        </p>
      </div>

      <div
        className={`grid w-full grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6 ${
          tone === 'setup' ? 'lg:items-center' : 'lg:items-start'
        }`}
      >
        {phase.steps.map((step) => (
          <StepCard key={step.number} {...step} />
        ))}
      </div>
    </section>
  );
}

function StepCard({ number, Icon, title, description }: Step) {
  return (
    <article className="relative flex flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_2px_5px_rgba(0,0,0,0.05)] md:flex-row md:items-start md:gap-4 lg:flex-col lg:gap-3">
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
