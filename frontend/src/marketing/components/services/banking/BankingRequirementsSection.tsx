import { CheckIcon, ClockIcon } from '../../icons';

/*
 * What to have ready — the document list, on a white band between the process
 * steps and the coverage strip. It exists because the single biggest cause of a
 * stalled banking application is a customer discovering mid-application that a
 * director's proof of address is three years old.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, one column of check rows.
 *   - tablet (md, 768px): px-10 py-14, two columns.
 *   - desktop (lg, 1024px): px-20 py-20, two columns capped so the rows stay
 *     readable, with the timing note beneath.
 */

const REQUIREMENTS = [
  {
    title: 'Formation documents',
    detail:
      'The registry certificate and the corporate documents for the entity the account belongs to.',
  },
  {
    title: 'Tax number',
    detail:
      'The company’s EIN or the equivalent in its jurisdiction. Banks ask for it before they can open anything.',
  },
  {
    title: 'Identification for each owner and director',
    detail:
      'A valid passport or national ID — for everyone with a meaningful stake, not only the person applying.',
  },
  {
    title: 'Proof of address, recently dated',
    detail:
      'A utility bill or bank statement for each person, usually issued within the last three months.',
  },
  {
    title: 'A plain description of the business',
    detail:
      'What you sell, to whom, and where the money comes from. Vagueness here is what gets applications held.',
  },
  {
    title: 'Where you trade, if you trade online',
    detail:
      'Your website or marketplace storefront. Payment platforms and banks both check that it matches what you told them.',
  },
];

export function BankingRequirementsSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-white px-5 py-10 md:gap-9 md:px-10 md:py-14 lg:gap-12 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          What to Have Ready
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          Every partner asks for its own variation of the same six things.
          Gathering them up front is the difference between an application that
          moves and one that sits.
        </p>
      </div>

      <ul className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:gap-x-16 lg:gap-y-6">
        {REQUIREMENTS.map(({ title, detail }) => (
          <li key={title} className="flex w-full items-start gap-2.5">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
            <div className="flex flex-1 flex-col items-start gap-1">
              <p className="w-full text-[14px] font-semibold leading-normal text-text lg:text-[15px]">
                {title}
              </p>
              <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
                {detail}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex w-full items-start gap-2 rounded-card border border-gray-200 bg-gray-50 p-4 md:items-center lg:p-5">
        <ClockIcon className="mt-0.5 size-4 shrink-0 text-primary md:mt-0" />
        <p className="flex-1 text-[13px] font-medium leading-5 text-text-secondary lg:text-[14px]">
          Missing something? Start anyway. We will tell you exactly what the
          shortlisted partner needs, and nothing is submitted until the file is
          complete.
        </p>
      </div>
    </section>
  );
}
