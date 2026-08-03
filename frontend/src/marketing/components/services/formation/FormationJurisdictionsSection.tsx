import { CheckIcon, ClockIcon, GlobeIcon } from '../../icons';

/*
 * Where we file — one card per jurisdiction, listing the entity types available
 * there, the documents that registry asks for, and its average timeline. The
 * card treatment and the timelines match the How It Works page's country
 * variance section deliberately: the same figures on two pages must not
 * disagree, and marketing has no data source, so the copy is the source.
 * Three breakpoints:
 *   - mobile (<768px):  bg-white, px-5 py-10, cards stack in one column.
 *   - tablet (md, 768px): bg-gray-50 with a hairline, px-10 py-14, 2-up grid.
 *   - desktop (lg, 1024px): px-20 py-20, 4-up equal-width row.
 */

type Jurisdiction = {
  name: string;
  entities: string;
  docs: string[];
  timeline: string;
};

const JURISDICTIONS: Jurisdiction[] = [
  {
    name: 'United States',
    entities: 'LLC · INC',
    docs: [
      'Passport or National ID',
      'Proof of Physical Address',
      'Brief business description',
    ],
    timeline: '3-5 Business Days',
  },
  {
    name: 'United Kingdom',
    entities: 'LTD',
    docs: [
      'Proof of Identity (KYC)',
      'Companies House Forms',
      'Registered Office address',
    ],
    timeline: '2-4 Business Days',
  },
  {
    name: 'Canada',
    entities: 'LTD · Provincial',
    docs: [
      'Provincial registration docs',
      'Director identities',
      'BN Registration request',
    ],
    timeline: '5-7 Business Days',
  },
  {
    name: 'Europe',
    entities: 'LTD · EEA equivalents',
    docs: [
      'Notarized deeds (EEA)',
      'VAT registration form',
      'EU residency proof',
    ],
    timeline: '5-10 Business Days',
  },
];

export function FormationJurisdictionsSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-white px-5 py-10 md:gap-9 md:border-y md:border-gray-200 md:bg-gray-50 md:px-10 md:py-14 lg:gap-12 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          Where We File, and What Each Registry Needs
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          The paperwork is not the same in two countries. Here is what each
          destination asks for and how long it usually takes once the registry
          has it.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {JURISDICTIONS.map((jurisdiction) => (
          <JurisdictionCard key={jurisdiction.name} {...jurisdiction} />
        ))}
      </div>

      <p className="w-full text-[12px] font-normal leading-[18px] text-text-secondary md:text-[13px] md:leading-normal">
        Timelines are registry processing averages and start once your
        application is complete — they exclude the time a registry takes for
        additional checks.
      </p>
    </section>
  );
}

function JurisdictionCard({ name, entities, docs, timeline }: Jurisdiction) {
  return (
    <article className="flex h-full w-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:gap-5 lg:p-6">
      <header className="flex w-full flex-col items-start gap-1.5 border-b border-gray-200 pb-3 lg:pb-4">
        <div className="flex w-full items-center gap-2">
          <GlobeIcon className="size-5 shrink-0 text-accent" />
          <h3 className="font-marketing text-[18px] font-bold text-text lg:text-[20px]">
            {name}
          </h3>
        </div>
        <p className="text-[12px] font-semibold uppercase leading-normal text-primary lg:text-[13px]">
          {entities}
        </p>
      </header>

      <div className="flex w-full flex-col items-start gap-3 lg:gap-4">
        <div className="flex w-full flex-col items-start gap-1.5 lg:gap-2">
          <p className="text-[11px] font-bold uppercase text-gray-400 lg:text-[12px]">
            Required Documents:
          </p>
          <div className="flex w-full flex-col items-start gap-1.5">
            {docs.map((doc) => (
              <div key={doc} className="flex w-full items-start gap-2">
                <CheckIcon className="mt-0.5 size-[14px] shrink-0 text-success" />
                <p className="flex-1 text-[13px] font-normal leading-[18px] text-text-secondary">
                  {doc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-1 lg:gap-1.5">
          <p className="text-[11px] font-bold uppercase text-gray-400 lg:text-[12px]">
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
