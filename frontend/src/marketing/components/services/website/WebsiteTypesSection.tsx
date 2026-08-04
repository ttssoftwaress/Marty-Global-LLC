import type { ReactNode } from 'react';

import {
  BriefcaseIcon,
  CpuIcon,
  FileTextIcon,
  MonitorIcon,
  ShoppingCartIcon,
} from '../../icons';

/*
 * The five kinds of site we build, each with the platforms it can be built on.
 *
 * This is the order form's first question and its dependent second one, shown
 * as a page (`website_type` and the scoped `website_platform` options in the
 * field registry). The pairing is the point: offering Shopify for a blog or
 * Ghost for a store is how a brief arrives wrong, so the platforms are listed
 * against the site type that can actually use them.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column.
 *   - tablet (md, 768px): px-10 py-14, 2-up grid (the fifth card wraps).
 *   - desktop (lg, 1024px): px-20 py-20, 3-up grid.
 */

type SiteType = {
  Icon: (props: { className?: string }) => ReactNode;
  name: string;
  blurb: string;
  platforms: string[];
};

const SITE_TYPES: SiteType[] = [
  {
    Icon: BriefcaseIcon,
    name: 'Business / brochure site',
    blurb:
      'The site a customer, a bank, or a marketplace looks up when they want to know the company is real.',
    platforms: ['WordPress', 'Webflow', 'Next.js'],
  },
  {
    Icon: ShoppingCartIcon,
    name: 'Online store',
    blurb:
      'Products, a checkout, and payments — your own storefront alongside whatever marketplaces you sell on.',
    platforms: ['Shopify', 'WooCommerce'],
  },
  {
    Icon: MonitorIcon,
    name: 'Single landing page',
    blurb:
      'One page doing one job: a launch, a campaign, or a product that does not need a site around it yet.',
    platforms: ['WordPress', 'Webflow', 'Framer'],
  },
  {
    Icon: FileTextIcon,
    name: 'Blog or publication',
    blurb:
      'Regular writing with a structure behind it — categories, authors, and an editor you will actually use.',
    platforms: ['WordPress', 'Ghost'],
  },
  {
    Icon: CpuIcon,
    name: 'Web application',
    blurb:
      'Something with logins, data, and logic behind it, built from scratch rather than assembled from a theme.',
    platforms: ['Next.js', 'Laravel'],
  },
];

export function WebsiteTypesSection() {
  return (
    <section className="flex w-full flex-col items-start gap-6 bg-white px-5 py-10 md:gap-8 md:px-10 md:py-14 lg:gap-10 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          What Kind of Site Do You Need?
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          It is the first question on the brief, because it decides everything
          after it — including which platforms are worth building on.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {SITE_TYPES.map(({ Icon, name, blurb, platforms }) => (
          <article
            key={name}
            className="flex h-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:gap-5 lg:p-6"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light lg:size-11">
              <Icon className="size-[18px] text-primary lg:size-5" />
            </div>

            <div className="flex w-full flex-1 flex-col items-start gap-2">
              <h3 className="w-full font-marketing text-[18px] font-bold leading-normal text-text lg:text-[20px]">
                {name}
              </h3>
              <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
                {blurb}
              </p>
            </div>

            <div className="flex w-full flex-col items-start gap-2 border-t border-gray-200 pt-3 lg:pt-4">
              <p className="text-[11px] font-bold uppercase leading-normal text-gray-400 lg:text-[12px]">
                Built on:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {platforms.map((platform) => (
                  <span
                    key={platform}
                    className="rounded-pill bg-gray-50 px-3 py-1 text-[11px] font-semibold leading-normal text-text-secondary lg:text-[12px]"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="w-full text-[12px] font-normal leading-[18px] text-text-secondary md:text-[13px] md:leading-normal">
        No preference? Pick &quot;recommend one for me&quot; on the brief and we
        will advise once we know what the site has to do.
      </p>
    </section>
  );
}
