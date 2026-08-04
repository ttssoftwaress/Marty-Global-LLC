import { useState } from 'react';

import { ChevronDownIcon, GlobeIcon } from '../../icons';
import {
  COUNTRY_COUNT,
  COVERAGE,
  US_STATES_LABEL,
  type CoverageCountry,
} from '../coverage';

/*
 * Where a service is available, as an expandable list.
 *
 * A disclosure rather than a popover on purpose (Design.md): this is inline
 * content that grows the page, not a floating layer, so it needs no dismissal
 * hook, no focus trap, and no scroll lock — a button, `aria-expanded`, and the
 * region it controls. Keyboard and screen-reader behaviour comes free from
 * using real buttons.
 *
 * Two shapes, one component:
 *   - `variant="compact"` — one control inside a service card on `/services`.
 *     Opens to the country list; each country opens to its states.
 *   - `variant="full"` — a page section on a service detail page, with a
 *     heading, the summary line, and the countries as a grid.
 *
 * Country and state level only. The exact street addresses stay out of public
 * pages (see `coverage.ts`) — the customer gets theirs on the order.
 */

type ServiceCoverageDisclosureProps = {
  variant?: 'compact' | 'full';
  /** Overrides the default heading on the full variant. */
  heading?: string;
  subheading?: string;
  /** What we hold in each place — "a registered-agent address", "a mail desk". */
  what?: string;
};

export function ServiceCoverageDisclosure({
  variant = 'compact',
  heading = 'Where This Service Is Available',
  subheading,
  what = 'an address',
}: ServiceCoverageDisclosureProps) {
  if (variant === 'full') {
    return (
      <section className="flex w-full flex-col items-start gap-6 bg-white px-5 py-10 md:gap-8 md:px-10 md:py-14 lg:gap-10 lg:px-20 lg:py-20">
        <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
          <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
            {heading}
          </h2>
          <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
            {subheading ??
              `We hold ${what} in ${US_STATES_LABEL} — plus DC, Guam, and Puerto Rico — and in ${COUNTRY_COUNT - 1} more countries. Open a country to see the states and regions inside it.`}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {COVERAGE.map((country) => (
            <CountryRow key={country.code} country={country} />
          ))}
        </div>

        <p className="w-full text-[12px] font-normal leading-[18px] text-text-secondary md:text-[13px] md:leading-normal">
          States and regions only — you get the exact address on your order. Not
          seeing where you need to be? Tell us and we will say whether we can
          cover it.
        </p>
      </section>
    );
  }

  return <CompactCoverage />;
}

/*
 * The card-sized control: one line that opens to the country list, each country
 * opening to its own states. Two levels of disclosure keeps a 49-item US list
 * from burying the card it sits in.
 */
function CompactCoverage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-start gap-2 border-t border-gray-200 pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <GlobeIcon className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-[12px] font-semibold leading-normal text-primary lg:text-[13px]">
          {US_STATES_LABEL} &amp; {COUNTRY_COUNT - 1} more countries
        </span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-primary transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="flex w-full flex-col items-start gap-1.5 pt-1">
          {COVERAGE.map((country) => (
            <CountryRow key={country.code} country={country} dense />
          ))}
        </div>
      )}
    </div>
  );
}

function CountryRow({
  country,
  dense = false,
}: {
  country: CoverageCountry;
  dense?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const single = country.areas.length === 1;

  return (
    <div
      className={`flex w-full flex-col items-start rounded-[10px] border border-gray-200 bg-white ${
        dense ? 'gap-1.5 p-2.5' : 'gap-2 p-3 lg:p-4'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span aria-hidden="true" className="shrink-0 text-[14px] leading-none">
          {country.flag}
        </span>
        <span
          className={`flex-1 font-semibold leading-normal text-text ${
            dense ? 'text-[12px]' : 'text-[14px] lg:text-[15px]'
          }`}
        >
          {country.label}
        </span>
        <span
          className={`shrink-0 rounded-pill bg-gray-50 px-2 py-0.5 font-semibold leading-normal text-text-secondary ${
            dense ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          {/* "49 states" would contradict the "46 US states" headline — the
           * count includes DC, Guam, and Puerto Rico, which are not states. */}
          {single
            ? country.areas[0]
            : `${country.areas.length} states & regions`}
        </span>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/*
       * A run of text, not a grid of chips. Forty-nine pill-shaped chips with a
       * pin glyph each turned "which states?" into a wall the height of the card
       * it sat in; the same list reads faster and takes a quarter of the space
       * as one wrapped sentence with dot separators.
       */}
      {/*
       * Joined into one string rather than a span per area. Separators rendered
       * as their own elements carry no whitespace, so the browser saw the whole
       * list as a single unbreakable word and it ran off the side of the card —
       * the only breaks it could find were the spaces inside "North Carolina".
       */}
      {open && (
        <p
          className={`w-full leading-[18px] text-text-secondary ${
            dense ? 'text-[11px]' : 'text-[12px] lg:text-[13px] lg:leading-5'
          }`}
        >
          {country.areas.join(' · ')}
        </p>
      )}
    </div>
  );
}
