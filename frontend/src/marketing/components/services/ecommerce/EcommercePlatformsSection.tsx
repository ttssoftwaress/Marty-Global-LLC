import { ShoppingCartIcon } from '../../icons';

/*
 * The marketplaces we register sellers on — four compact cards on a white band,
 * under the hero. The Services page lists the same four as text badges; this is
 * the same list with one line of context each.
 *
 * Each line is deliberately evergreen. Naming a platform's current document
 * list or threshold would be wrong within a release or two, and a marketing page
 * nobody re-checks is exactly where a stale rule survives — so the copy says
 * what the platform is for, and the closing note says the rules move.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column.
 *   - tablet (md, 768px): px-10 py-14, 2-up grid.
 *   - desktop (lg, 1024px): px-20 py-16, 4-up row.
 */

const PLATFORMS = [
  {
    name: 'Amazon',
    blurb:
      'The largest of them and the strictest on verification — a business seller account here is the one most founders come for.',
  },
  {
    name: 'eBay',
    blurb:
      'A business seller account for cross-border listing, registered under the company rather than a personal profile.',
  },
  {
    name: 'Walmart',
    blurb:
      'Marketplace access for sellers with a registered US entity, where approval is granted rather than opened on demand.',
  },
  {
    name: 'Alibaba',
    blurb:
      'A verified supplier or buyer account for trading into and out of Asia under your registered company.',
  },
];

export function EcommercePlatformsSection() {
  return (
    <section className="flex w-full flex-col items-start gap-6 bg-white px-5 py-10 md:gap-8 md:px-10 md:py-14 lg:gap-10 lg:px-20 lg:py-16">
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          Where We Get You Registered
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          Business seller accounts on the marketplaces that expect a registered
          local entity behind the profile.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {PLATFORMS.map(({ name, blurb }) => (
          <article
            key={name}
            className="flex h-full flex-col items-start gap-3 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:gap-4 lg:p-6"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light lg:size-11">
              <ShoppingCartIcon className="size-[18px] text-primary lg:size-5" />
            </div>
            <h3 className="w-full font-marketing text-[18px] font-bold leading-normal text-text lg:text-[20px]">
              {name}
            </h3>
            <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
              {blurb}
            </p>
          </article>
        ))}
      </div>

      <p className="w-full text-[12px] font-normal leading-[18px] text-text-secondary md:text-[13px] md:leading-normal">
        Marketplace names are stated to say where we file — Marty Global is not
        affiliated with, endorsed by, or a partner of any of them, and each
        platform sets and changes its own requirements. We check the current
        rules before submitting.
      </p>
    </section>
  );
}
