/*
 * Why Founders Trust Marty Global LLC — the fifth section of the About page.
 * A centered header, a row of compliance pills, a grid of trust stats, and a
 * regional-expertise block. Sits on a Primary-light surface. Three breakpoints
 * per Figma:
 *   - mobile (<768px):  px-4 py-10, 28px section gap; header left-aligned with
 *     10px gap (24px heading, 14px/20 lead, full width); pills wrap left with
 *     8px gap (px-3 py-1.5, Gray-200 border, 12px); stats stack 1 column, 12px
 *     gap (p-5, 12px radius, sm shadow, 28px value, 13px label); regions label
 *     left (12px), rows stack in a 8px-gap column (white bg, 8px radius, 9px
 *     flag, 12px text).
 *   - tablet (md, 768px): px-10 py-20, 48px section gap; header center-aligned
 *     with 16px gap (32px/40 heading, 16px/24 lead); pills center-wrap with 12px
 *     gap (px-4 py-1.5, Gray-300 border, 12px); stats 2×2 grid, 16px gap (p-5,
 *     12px radius, Gray-200 border, sm shadow, 28px value, 13px label); regions
 *     label center (12px), rows stack in a 10px-gap column (Gray-50 bg, 8px
 *     radius, 10px flag, 13px text).
 *   - desktop (lg, 1024px): px-20 py-24, 48px section gap; header center-aligned
 *     with 12px gap (40px heading, 16px lead capped at 700px); pills center with
 *     16px gap (px-5 py-2, Gray-300 border, 13px); stats 1×4 row, 24px gap (p-6,
 *     16px radius, md shadow, 40px value, 14px label); regions label center
 *     (14px), rows in a single 16px-gap centered row (Gray-50 bg, 8px radius,
 *     10px flag, 13px text).
 * The heading uses the marketing (Poppins) face in brand primary; the lead and
 * stat labels are secondary text; stat values and pill/flag text are brand
 * primary; region labels are primary text on flag chips filled Primary-light.
 * Text copy follows the desktop link (AGENTS.md single source of truth).
 */

const PILLS = [
  'GDPR-Aligned',
  'Secure Payment Processing',
  'Licensed Registered Agent',
  'SOC 2 Practices',
];

const STATS = [
  { value: '10,000+', label: 'Companies successfully incorporated' },
  { value: '15,000+', label: 'Corporate bank accounts opened' },
  { value: '4.9/5', label: 'Trustpilot rating across global founders' },
  { value: '7+ Years', label: 'Managing high-volume international filings' },
];

const REGIONS = [
  { code: 'US', label: 'United States (Delaware, Wyoming, Florida)' },
  { code: 'UK', label: 'United Kingdom (Companies House)' },
  { code: 'CA', label: 'Canada (Federal & Provincial)' },
  { code: 'EU', label: 'Europe (Estonia, Ireland, Germany)' },
];

export function WhyUsSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-primary-light px-4 py-10 md:gap-12 md:px-10 md:py-20 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-start gap-2.5 md:items-center md:gap-4 md:text-center lg:gap-3">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-normal text-primary md:text-[32px] md:leading-10 lg:text-[40px]">
          Why Founders Trust Marty Global LLC
        </h2>
        <p className="w-full text-[14px] font-normal leading-5 text-text-secondary md:text-[16px] md:leading-6 lg:mx-auto lg:w-[700px]">
          Entity setup requires more than submitting a form. We build
          enterprise-grade credibility on top of direct regional regulatory
          alignment.
        </p>
      </div>

      <div className="flex w-full flex-wrap items-start gap-2 md:justify-center md:gap-3 lg:gap-4">
        {PILLS.map((pill) => (
          <div
            key={pill}
            className="flex items-start rounded-pill border border-gray-200 bg-white px-3 py-1.5 md:border-gray-300 md:px-4 lg:px-5 lg:py-2"
          >
            <p className="whitespace-nowrap text-[12px] font-semibold leading-normal text-primary lg:text-[13px]">
              {pill}
            </p>
          </div>
        ))}
      </div>

      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-start gap-1 rounded-xl bg-white p-5 shadow-sm-elevation md:gap-2 md:border md:border-gray-200 lg:gap-2 lg:rounded-card lg:border-0 lg:p-6 lg:shadow-md-elevation"
          >
            <p className="font-marketing text-[28px] font-bold text-primary lg:text-[40px]">
              {stat.value}
            </p>
            <p className="text-[13px] font-normal text-text-secondary lg:text-[14px]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col items-start gap-3 md:items-center md:gap-4">
        <p className="w-full text-[12px] font-semibold uppercase leading-normal text-text-secondary md:w-auto md:text-center lg:text-[14px]">
          Licensed &amp; Compliant Across 4 Regions
        </p>
        <div className="flex w-full flex-col items-start gap-2 md:gap-2.5 lg:flex-row lg:justify-center lg:gap-4">
          {REGIONS.map((region) => (
            <div
              key={region.code}
              className="flex w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 md:gap-3 md:bg-gray-50 md:px-4 lg:w-auto"
            >
              <div className="flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-primary-light">
                <p className="whitespace-nowrap text-center text-[9px] font-bold leading-normal text-primary md:text-[10px]">
                  {region.code}
                </p>
              </div>
              <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-normal text-text md:flex-none md:whitespace-nowrap md:text-[13px]">
                {region.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
