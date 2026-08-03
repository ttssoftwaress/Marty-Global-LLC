import { CheckIcon, ShieldCheckIcon } from '../../icons';

/*
 * Where our work ends and the bank's begins — our part on the left, the limits
 * on the right. Same copy-left / card-right layout as the mail room uses section
 * and the agent role section.
 *
 * The limits card is not a disclaimer bolted on: banking is the service where a
 * customer is most likely to expect an outcome nobody but the bank can give, and
 * AGENTS.md forbids inventing guarantees. Saying it here, in the same weight as
 * the rest of the page, is cheaper than saying it after a decline.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column, the card below the copy.
 *   - tablet (md, 768px): px-10 py-14, still stacked, roomier type.
 *   - desktop (lg, 1024px): px-20 py-20, copy left / card right.
 */

const OUR_PART = [
  'Shortlist the partner banks that accept your entity type, your jurisdiction, and your business model',
  'Assemble the application file — formation documents, tax number, ownership structure, business description',
  'Check it against that partner’s onboarding requirements before it is submitted, not after',
  'Submit it, answer the bank’s follow-up questions with you, and keep the status visible in your dashboard',
];

const LIMITS = [
  {
    title: 'The bank decides',
    body: 'Approval is the bank’s call under its own compliance rules. Nobody can promise you an account — treat anyone who does as a warning sign.',
  },
  {
    title: 'You complete the verification',
    body: 'Every partner runs its own KYC on the owners and directors. We prepare you for it and stay with the application, but we cannot sit the check for you.',
  },
  {
    title: 'We never touch the money',
    body: 'The account is opened in your company’s name and the credentials go to you. Marty Global is not a bank, holds no funds, and has no access to the account.',
  },
];

export function BankingScopeSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-gray-50 px-5 py-10 md:gap-9 md:px-10 md:py-14 lg:flex-row lg:items-start lg:gap-16 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-5 lg:flex-1 lg:gap-7">
        <div className="flex w-full flex-col items-start gap-3 lg:gap-4">
          <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
            What We Do, and What the Bank Does
          </h2>
          <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
            Opening a business account as a non-resident fails on paperwork far
            more often than on merit. Our job is the paperwork, and picking the
            partners your company can actually pass.
          </p>
        </div>

        <ul className="flex w-full flex-col items-start gap-3 lg:gap-3.5">
          {OUR_PART.map((item) => (
            <li key={item} className="flex w-full items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
              <span className="flex-1 text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] lg:leading-[22px]">
                {item}
              </span>
            </li>
          ))}
        </ul>

        <p className="w-full text-[12px] font-medium leading-[18px] text-text-secondary md:text-[13px] md:leading-5">
          Marty Global is a filing service provider, not a law firm and not a
          bank, and does not give legal, tax, or financial advice.
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
          If a partner declines, we tell you the reason where the bank gives one
          and move to the next partner on your shortlist.
        </p>
      </aside>
    </section>
  );
}
