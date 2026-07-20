import { useState } from 'react';

import { ChevronDownIcon } from '../icons';

/*
 * FAQ — shared marketing accordion (home + services). A single accordion of
 * question/answer items. Three breakpoints per Figma:
 *   - mobile (<768px):  heading 28px, container full-width with 12px padding and
 *     10px gaps; items 12px padding, 14px question / 12px answer, 14px chevron.
 *   - tablet (md, 768px): heading 32px, container 16px padding / 12px gaps; items
 *     16px padding, 15px question / 13px answer, 18px chevron.
 *   - desktop (lg, 1024px): heading 40px, container fixed 900px wide; items 16px
 *     padding, 16px question / 14px answer, 18px chevron.
 * Every item is open by default (matching the Figma frames); clicking a question
 * toggles it and rotates the chevron. Copy is passed per page — the home page
 * keeps the defaults, services passes its own questions.
 */

export type Faq = {
  question: string;
  answer: string;
};

const HOME_FAQS: Faq[] = [
  {
    question: 'How long does LLC formation take?',
    answer:
      'Typically 3 to 7 business days depending on state/jurisdiction processing speeds. Delaware and Wyoming usually settle fast.',
  },
  {
    question: 'What jurisdictions do you support?',
    answer:
      'We currently support legal company formation, addresses, and banking routes across the United States (all 50 states), UK, Canada, and EEA European Union nations.',
  },
  {
    question: 'Can non-US residents open a US bank account?',
    answer:
      'Yes. Our partnerships with remote banking platforms enable global founders to open corporate accounts online without visiting the US.',
  },
  {
    question: 'What is included in the Virtual Mail Room?',
    answer:
      'You receive a physical commercial street address, secure digital scanning of envelopes, email delivery notifications, and physical forwarding options.',
  },
  {
    question: 'Do I need a Registered Agent?',
    answer:
      'Yes, states in the US require a physical agent on standby to receive official state notices and compliance updates during business hours.',
  },
  {
    question: 'What is your refund policy?',
    answer:
      'We offer a 100% money-back guarantee before government filings are officially processed. Once state fees are paid, those become non-refundable.',
  },
];

type FaqSectionProps = {
  heading?: string;
  subheading?: string;
  faqs?: Faq[];
};

export function FaqSection({
  heading = 'Frequently Asked Questions',
  subheading = 'Get clear, reliable answers on our international services, filing jurisdictions, and timelines.',
  faqs = HOME_FAQS,
}: FaqSectionProps = {}) {
  const [openItems, setOpenItems] = useState<Set<number>>(
    () => new Set(faqs.map((_, index) => index)),
  );

  const toggle = (index: number) => {
    setOpenItems((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <section className="flex w-full flex-col items-center gap-8 bg-gray-50 px-4 py-16 md:gap-12 md:px-10 md:py-20 lg:gap-16 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-center gap-2.5 text-center md:gap-3">
        <h2 className="w-full font-marketing text-[28px] font-bold leading-[1.2] text-text md:text-[32px] lg:text-[40px]">
          {heading}
        </h2>
        <p className="w-full text-[14px] leading-5 text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-normal">
          {subheading}
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-2.5 rounded-card border border-gray-200 bg-white p-3 md:gap-3 md:p-4 lg:w-[900px]">
        {faqs.map((faq, index) => (
          <FaqItem
            key={faq.question}
            {...faq}
            isOpen={openItems.has(index)}
            onToggle={() => toggle(index)}
          />
        ))}
      </div>
    </section>
  );
}

type FaqItemProps = Faq & {
  isOpen: boolean;
  onToggle: () => void;
};

function FaqItem({ question, answer, isOpen, onToggle }: FaqItemProps) {
  return (
    <div className="flex w-full flex-col items-start gap-2 rounded-[12px] bg-gray-50 p-3 md:gap-3 md:p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0 flex-1 font-marketing text-[14px] font-semibold leading-normal text-text md:text-[15px] lg:text-[16px]">
          {question}
        </span>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 text-primary transition-transform duration-200 md:size-[18px] ${
            isOpen ? '' : '-rotate-90'
          }`}
        />
      </button>
      {isOpen && (
        <p className="w-full text-[12px] leading-[18px] text-text-secondary md:text-[13px] md:leading-5 lg:text-[14px] lg:leading-[22px]">
          {answer}
        </p>
      )}
    </div>
  );
}
