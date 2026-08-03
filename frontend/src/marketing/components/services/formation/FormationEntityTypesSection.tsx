import type { ReactNode } from 'react';

import { BuildingIcon, CheckIcon, GlobeIcon, LandmarkIcon } from '../../icons';

/*
 * Entity types — the three structures we file, one card each. Over a Gray-50
 * field, following the Services grid's card treatment. Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column, 12px-radius cards.
 *   - tablet (md, 768px): px-10 py-14, 2-up grid (the third card wraps).
 *   - desktop (lg, 1024px): px-20 py-20, 3-up row, 32px card padding.
 *
 * The section closes with the not-a-law-firm note in the one place a visitor is
 * most likely to want advice: we file the structure the customer chooses, and we
 * do not tell them which one to choose (AGENTS.md — never imply legal advice).
 */

type EntityType = {
  Icon: (props: { className?: string }) => ReactNode;
  code: string;
  title: string;
  regions: string;
  description: string;
  points: string[];
};

const ENTITY_TYPES: EntityType[] = [
  {
    Icon: BuildingIcon,
    code: 'LLC',
    title: 'Limited Liability Company',
    regions: 'United States — all 50 states',
    description:
      'The structure most non-resident founders file in the US. Delaware and Wyoming are the most commonly requested states, and we file in any of them.',
    points: [
      'Articles of Organization filed with the state',
      'Custom operating agreement prepared',
      'One year of Registered Agent service included',
      'EIN application support for non-residents',
    ],
  },
  {
    Icon: LandmarkIcon,
    code: 'INC',
    title: 'Corporation',
    regions: 'United States — all 50 states',
    description:
      'Filed where a corporate structure is needed — a share register, a board, or an investor who expects one. The same filing route as an LLC, with corporate documents instead.',
    points: [
      'Articles of Incorporation filed with the state',
      'Bylaws and initial share issuance documents',
      'One year of Registered Agent service included',
      'EIN application support for non-residents',
    ],
  },
  {
    Icon: GlobeIcon,
    code: 'LTD',
    title: 'Private Limited Company',
    regions: 'United Kingdom, Canada & Europe',
    description:
      'The equivalent registration outside the US. Each registry asks for its own forms and its own address, and we handle the difference for you.',
    points: [
      'Registration with the national or provincial registry',
      'Registered office address where the registry requires one',
      'Standard incorporation documents prepared',
      'Local tax number registration guidance',
    ],
  },
];

export function FormationEntityTypesSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-gray-50 px-5 py-10 md:gap-9 md:px-10 md:py-14 lg:gap-12 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          Three Structures, One Filing Partner
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          Tell us which entity you want and where you want it registered. We
          prepare the filing, submit it to the registry, and return the finished
          record to your dashboard.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {ENTITY_TYPES.map((entity) => (
          <EntityCard key={entity.code} {...entity} />
        ))}
      </div>

      <div className="flex w-full items-start gap-2 md:items-center md:justify-center">
        <p className="flex-1 text-[12px] font-medium leading-[18px] text-text-secondary md:flex-none md:text-center md:text-[13px] md:leading-normal">
          Choosing between them is your decision — Marty Global is a filing
          service provider, not a law firm, and does not give legal or tax
          advice.
        </p>
      </div>
    </section>
  );
}

function EntityCard({
  Icon,
  code,
  title,
  regions,
  description,
  points,
}: EntityType) {
  return (
    <article className="flex h-full flex-col items-start gap-5 rounded-[12px] border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.05)] lg:gap-6 lg:rounded-card lg:p-8">
      <div className="flex w-full items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-primary-light lg:size-14">
          <Icon className="size-6 text-primary lg:size-7" />
        </div>
        <span className="rounded-pill bg-accent-light px-3 py-1 font-marketing text-[12px] font-bold uppercase leading-normal text-accent lg:text-[13px]">
          {code}
        </span>
      </div>

      <div className="flex w-full flex-col items-start gap-1.5 lg:gap-2">
        <h3 className="w-full font-marketing text-[18px] font-bold leading-normal text-text md:text-[20px] lg:text-[22px]">
          {title}
        </h3>
        <p className="w-full text-[12px] font-semibold uppercase leading-normal text-gray-400 lg:text-[13px]">
          {regions}
        </p>
        <p className="w-full pt-1 text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] lg:leading-[22px]">
          {description}
        </p>
      </div>

      <ul className="flex w-full flex-col items-start gap-2 lg:gap-2.5">
        {points.map((point) => (
          <li key={point} className="flex w-full items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
            <span className="flex-1 text-[13px] font-normal leading-[18px] text-text-secondary lg:leading-normal">
              {point}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
