import { GlobeIcon } from '../icons';

/*
 * Jurisdictions strip — a slim band under the services grid listing the four
 * supported regions as flag pills over a primary-light field. Two breakpoints
 * per Figma (hidden entirely on mobile):
 *   - tablet (md, 768px): px-10 py-8, 16px gap, 14px uppercase heading; pills
 *     wrap and center in a flex-wrap row with 16px gaps.
 *   - desktop (lg, 1024px): px-20 py-10, 24px gap, 16px heading; pills sit in a
 *     single centered no-wrap row with 24px gaps.
 * Each pill is a white, gray-bordered capsule with a 15px globe glyph and a
 * 14px semibold region label.
 */

const REGIONS = [
  'United States',
  'United Kingdom',
  'Canada',
  'Europe',
] as const;

export function JurisdictionsStripSection() {
  return (
    <section className="hidden w-full flex-col items-center gap-4 bg-primary-light px-10 py-8 md:flex lg:gap-6 lg:px-20 lg:py-10">
      <p className="whitespace-nowrap font-marketing text-[14px] font-bold uppercase leading-normal text-primary lg:text-[16px]">
        Available Across 4 Regions
      </p>

      <div className="flex w-full flex-wrap items-center justify-center gap-4 lg:flex-nowrap lg:gap-6">
        {REGIONS.map((region) => (
          <RegionPill key={region} label={region} />
        ))}
      </div>
    </section>
  );
}

function RegionPill({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-pill border border-gray-200 bg-white px-5 py-2.5">
      <span className="flex size-4 shrink-0 items-center justify-center">
        <GlobeIcon className="size-[15px] text-primary" />
      </span>
      <span className="whitespace-nowrap text-[14px] font-semibold leading-normal text-text">
        {label}
      </span>
    </div>
  );
}
