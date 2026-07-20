import { CheckIcon, ClockIcon, GlobeIcon } from '../icons';

/*
 * How It Works — Country Variance section. A section header sits above a set of
 * destination cards, one per jurisdiction, each listing its required documents
 * and average filing timeline. The card content is the desktop copy at every
 * breakpoint; only layout and styling change. Three breakpoints per Figma:
 *   - mobile (<768px):  bg-white, px-5 py-12, 28px gap. The header carries an
 *     eyebrow pill; heading 28px/1.25, body 14px/1.5. Cards stack in one column
 *     (p-5, 16px gap, 12px header underline).
 *   - tablet (md, 768px): bg-gray-50 with a top/bottom hairline, px-10 py-16,
 *     36px gap. No eyebrow; heading 32px, body 15px. Cards are 376px wide and
 *     wrap two-up, centered (16px gap).
 *   - desktop (lg, 1024px): bg-gray-50 with a hairline, p-20, 48px gap. No
 *     eyebrow; header capped at 800px, heading 40px, body 16px. Cards render as
 *     a 4-up equal-width grid (24px gap, p-6).
 * Each card lists its docs as green check rows under a "REQUIRED DOCUMENTS:"
 * label, then the timeline under an "AVERAGE TIMELINE:" label with a navy clock.
 * The globe (accent), check (success), and clock (primary) glyphs reuse the
 * shared marketing icon set.
 */

type Country = {
  name: string;
  docs: string[];
  timeline: string;
};

const COUNTRIES: Country[] = [
  {
    name: 'USA',
    docs: [
      'Passport or National ID',
      'Proof of Physical Address',
      'Brief business description',
    ],
    timeline: '3-5 Business Days',
  },
  {
    name: 'UK',
    docs: [
      'Proof of Identity (KYC)',
      'Companies House Forms',
      'Registered Office address',
    ],
    timeline: '2-4 Business Days',
  },
  {
    name: 'Canada',
    docs: [
      'Provincial registration docs',
      'Director identities',
      'BN Registration request',
    ],
    timeline: '5-7 Business Days',
  },
  {
    name: 'Europe',
    docs: ['Notarized deeds (EEA)', 'VAT registration form', 'EU residency proof'],
    timeline: '5-10 Business Days',
  },
];

export function HowItWorksCountryVarianceSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-white px-5 py-12 md:gap-9 md:border-y md:border-gray-200 md:bg-gray-50 md:px-10 md:py-16 lg:gap-12 lg:p-20">
      <div className="flex w-full flex-col items-start gap-3 lg:w-[800px] lg:gap-4">
        <span className="inline-flex items-center rounded-pill bg-primary-light px-4 py-1.5 text-[11px] font-bold uppercase text-primary md:hidden">
          Adaptability
        </span>
        <h2 className="w-full font-marketing text-[28px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-normal lg:text-[40px]">
          One Process, Adapted to Where You&apos;re Building
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px]">
          Marty Global bridges jurisdictional friction seamlessly. Here is what
          is needed for each destination node:
        </p>
      </div>

      <div className="flex w-full flex-col items-stretch gap-4 md:flex-row md:flex-wrap md:content-center md:justify-center lg:flex-nowrap lg:gap-6">
        {COUNTRIES.map((country) => (
          <CountryCard key={country.name} {...country} />
        ))}
      </div>
    </section>
  );
}

function CountryCard({ name, docs, timeline }: Country) {
  return (
    <article className="flex w-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] md:w-[376px] lg:w-auto lg:flex-1 lg:gap-5 lg:p-6">
      <header className="flex w-full items-center gap-2 border-b border-gray-200 pb-3 lg:pb-4">
        <GlobeIcon className="size-5 shrink-0 text-accent" />
        <h3 className="whitespace-nowrap font-marketing text-[18px] font-bold text-text lg:text-[20px]">
          {name}
        </h3>
      </header>

      <div className="flex w-full flex-col items-start gap-3 lg:gap-4">
        <div className="flex w-full flex-col items-start gap-1.5 lg:gap-2">
          <p className="whitespace-nowrap text-[11px] font-bold uppercase text-gray-400 lg:text-[12px]">
            Required Documents:
          </p>
          <div className="flex w-full flex-col items-start gap-1.5">
            {docs.map((doc) => (
              <div key={doc} className="flex w-full items-center gap-2">
                <CheckIcon className="size-[14px] shrink-0 text-success" />
                <p className="flex-1 text-[13px] font-normal text-text-secondary">
                  {doc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-1 lg:gap-1.5">
          <p className="whitespace-nowrap text-[11px] font-bold uppercase text-gray-400 lg:text-[12px]">
            Average Timeline:
          </p>
          <div className="flex w-full items-center gap-2">
            <ClockIcon className="size-[14px] shrink-0 text-primary" />
            <p className="whitespace-nowrap text-[13px] font-semibold text-primary lg:text-[14px]">
              {timeline}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
