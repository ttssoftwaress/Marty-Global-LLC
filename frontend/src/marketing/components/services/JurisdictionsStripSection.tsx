import { COUNTRY_COUNT, COVERAGE } from './coverage';

/*
 * Jurisdictions strip — the slim band naming every country we hold an address
 * in, over a primary-light field.
 *
 * Rewritten twice. First (August 2026) to read from the coverage mirror rather
 * than a hardcoded four regions — it claimed "4 Regions" while the address book
 * held twelve countries, and it was hidden below `md`, so the one place a phone
 * visitor could have learned where we operate showed nothing.
 *
 * Then again, for density: twelve bordered pills wrapped onto two or three rows
 * and ate as much vertical space as a content section, for a list that is really
 * one sentence. It is now a single inline run — label, then the countries
 * separated by hairline dividers, wrapping only when it must. Same information,
 * roughly a third of the height.
 *
 * The state-level list lives behind the coverage disclosure, not here.
 */

export function JurisdictionsStripSection() {
  return (
    <section className="flex w-full flex-col items-center gap-2 bg-primary-light px-5 py-5 md:flex-row md:flex-wrap md:items-center md:justify-center md:gap-x-3 md:gap-y-2 md:px-10 md:py-6 lg:px-20">
      <p className="shrink-0 whitespace-nowrap font-marketing text-[11px] font-bold uppercase leading-normal tracking-wide text-primary md:text-[12px]">
        Available in {COUNTRY_COUNT} countries
      </p>

      <span
        aria-hidden="true"
        className="hidden h-3.5 w-px shrink-0 bg-primary/20 md:block"
      />

      <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 md:gap-x-2.5">
        {COVERAGE.map((country, index) => (
          <li key={country.code} className="flex items-center gap-2 md:gap-2.5">
            {index > 0 && (
              <span
                aria-hidden="true"
                className="h-2.5 w-px shrink-0 bg-primary/20"
              />
            )}
            <span className="flex items-center gap-1 whitespace-nowrap text-[12px] font-medium leading-normal text-text md:text-[13px]">
              <span aria-hidden="true" className="text-[12px] leading-none">
                {country.flag}
              </span>
              {country.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
