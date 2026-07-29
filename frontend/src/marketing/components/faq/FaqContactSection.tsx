import { Link } from 'react-router-dom';

import { MailIcon } from '../icons';

/*
 * The FAQ page's closing band — the route out for a visitor whose question the
 * library did not answer. Deliberately lighter than the navy `FinalCtaSection`
 * used elsewhere: someone reading the FAQ wants an answer, not a sign-up push,
 * so the primary action is "talk to us" and starting an order is the secondary.
 *
 * Three breakpoints: stacked and centered on mobile (px-4 py-12), roomier on
 * tablet (px-10 py-16), and a centered 800px column on desktop (px-20 py-20)
 * with the two actions in a row.
 */

export function FaqContactSection() {
  return (
    <section className="w-full bg-white px-4 py-12 md:px-10 md:py-16 lg:px-20 lg:py-20">
      <div className="mx-auto flex w-full max-w-[800px] flex-col items-center gap-5 rounded-card border border-gray-200 bg-gray-50 px-6 py-10 text-center md:gap-6 md:px-10 md:py-12">
        <div className="flex size-12 items-center justify-center rounded-[14px] bg-primary-light text-primary md:size-14">
          <MailIcon className="size-6" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2 md:gap-3">
          <h2 className="font-marketing text-[22px] font-bold leading-[1.25] text-text md:text-[28px] lg:text-[32px]">
            Still have a question?
          </h2>
          <p className="text-[14px] leading-[22px] text-text-secondary md:text-[15px] md:leading-[24px] lg:text-[16px]">
            Our team answers in live chat during office hours, and replies to
            every message within one business day. Tell us what you are building
            and we will tell you what it takes.
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row md:items-center">
          <Link
            to="/contact"
            className="btn btn-primary h-auto rounded-input px-6 py-3 text-[15px]"
          >
            Contact our team
          </Link>
          <Link
            to="/services"
            className="btn btn-secondary h-auto rounded-input px-6 py-3 text-[15px]"
          >
            Browse services
          </Link>
        </div>
      </div>
    </section>
  );
}
