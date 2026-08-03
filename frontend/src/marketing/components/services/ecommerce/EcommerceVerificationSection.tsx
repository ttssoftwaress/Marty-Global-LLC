import { CheckIcon, ShieldCheckIcon } from '../../icons';

/*
 * What every marketplace verifies — the checks on the left, the limits on the
 * right. Same copy-left / card-right layout as the banking scope section, and
 * for the same reason: the outcome belongs to a third party, so the boundary is
 * stated at full weight rather than as a footnote.
 *
 * The checks are the ones common to all of these platforms, deliberately not
 * per-platform specifics — see the note in EcommercePlatformsSection.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column, the card below the copy.
 *   - tablet (md, 768px): px-10 py-14, still stacked, roomier type.
 *   - desktop (lg, 1024px): px-20 py-20, copy left / card right.
 */

const CHECKS = [
  'That the company exists and is registered where you say — checked against the filing itself, not against what you typed',
  'That the business address is real and reachable, often confirmed by sending something to it',
  'Government ID for the person behind the account, and their connection to the company',
  'A bank account in the company’s name for payouts, matching the seller profile exactly',
  'That what you plan to sell is allowed in that category and that market',
];

const LIMITS = [
  {
    title: 'The marketplace decides',
    body: 'Approval is theirs, under rules they change without notice. Nobody can promise you a seller account — treat anyone who does the way you would treat a guaranteed bank account.',
  },
  {
    title: 'Some checks only you can pass',
    body: 'A video verification call or a code posted to your address has to be completed by you. We prepare you for both and stay with the application.',
  },
  {
    title: 'The store stays yours',
    body: 'We register and verify the account in your company’s name and hand you the credentials. Listings, pricing, fulfilment, and customer service are yours to run.',
  },
];

export function EcommerceVerificationSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-gray-50 px-5 py-10 md:gap-9 md:px-10 md:py-14 lg:flex-row lg:items-start lg:gap-16 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-5 lg:flex-1 lg:gap-7">
        <div className="flex w-full flex-col items-start gap-3 lg:gap-4">
          <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
            What Every Marketplace Verifies
          </h2>
          <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
            They ask for different documents in a different order, but they are
            all checking the same five things — and checking them against each
            other.
          </p>
        </div>

        <ul className="flex w-full flex-col items-start gap-3 lg:gap-3.5">
          {CHECKS.map((check) => (
            <li key={check} className="flex w-full items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
              <span className="flex-1 text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] lg:leading-[22px]">
                {check}
              </span>
            </li>
          ))}
        </ul>

        <p className="w-full text-[12px] font-medium leading-[18px] text-text-secondary md:text-[13px] md:leading-5">
          One mismatch between them is the usual reason a new seller account is
          held — which is why we line up the entity, the address, and the bank
          account before anything is submitted.
        </p>
      </div>

      <aside className="flex w-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:w-[420px] lg:shrink-0 lg:gap-5 lg:p-7">
        <div className="flex w-full items-center gap-2.5 border-b border-gray-200 pb-3 lg:pb-4">
          <ShieldCheckIcon className="size-5 shrink-0 text-accent" />
          <h3 className="font-marketing text-[16px] font-bold leading-normal text-text lg:text-[18px]">
            What We Cannot Do
          </h3>
        </div>

        {LIMITS.map((entry) => (
          <div key={entry.title} className="flex w-full flex-col items-start gap-1.5">
            <p className="text-[12px] font-bold uppercase leading-normal text-primary lg:text-[13px]">
              {entry.title}
            </p>
            <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
              {entry.body}
            </p>
          </div>
        ))}

        <p className="w-full border-t border-gray-200 pt-3 text-[12px] font-medium leading-[18px] text-text-secondary lg:pt-4 lg:text-[13px] lg:leading-5">
          Marty Global is a filing service provider, not a law firm, and does not
          give legal or tax advice.
        </p>
      </aside>
    </section>
  );
}
