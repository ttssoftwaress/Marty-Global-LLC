import { Link } from 'react-router-dom';

import { CreditCardIcon } from '../../icons';

/*
 * "What it costs" — the band that answers the question every service detail page
 * deliberately does not answer with a number.
 *
 * AGENTS.md: marketing never quotes a price. An amount depends on the service,
 * the jurisdiction, and that jurisdiction's government fees, and the binding
 * figure is the itemised quote issued in the customer's dashboard after review.
 * Naming a number here would be wrong somewhere, so every service page explains
 * the mechanism instead — and does it in the same words, from this one component.
 *
 * Primary-light field, matching the jurisdictions strip on the Services page.
 * Stacked on mobile, a centered column on tablet, icon-left with the CTA on the
 * right at desktop.
 */

type ServiceQuoteBandProps = {
  /** The service-specific first sentence — why this one is priced the way it is. */
  lead: string;
};

export function ServiceQuoteBand({ lead }: ServiceQuoteBandProps) {
  return (
    <section className="flex w-full flex-col items-start gap-5 bg-primary-light px-5 py-10 md:items-center md:px-10 md:py-14 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-20 lg:py-16">
      <div className="flex w-full flex-col items-start gap-3 md:items-center md:text-center lg:max-w-[720px] lg:flex-row lg:items-start lg:gap-5 lg:text-left">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-white lg:size-12">
          <CreditCardIcon className="size-5 text-primary lg:size-6" />
        </div>

        <div className="flex w-full flex-col items-start gap-2 md:items-center lg:items-start">
          <h2 className="w-full font-marketing text-[20px] font-bold leading-[1.25] text-text md:text-[24px] lg:text-[26px]">
            What It Costs
          </h2>
          <p className="w-full text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] lg:text-[15px] lg:leading-[24px]">
            {lead} Submit your application first — we review it and issue an
            itemised quote in your dashboard, before any work starts and with
            nothing to pay until you accept it. Quotes settle in USDT (TRC-20) or
            by bank transfer.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row md:items-center lg:shrink-0">
        <Link
          to="/get-started"
          className="flex items-center justify-center whitespace-nowrap rounded-input bg-primary px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover md:py-3 lg:px-7 lg:text-[16px]"
        >
          Get a Quote
        </Link>
      </div>
    </section>
  );
}
