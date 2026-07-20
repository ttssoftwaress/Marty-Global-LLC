import type { ReactNode } from 'react';

import dashboardCard from '@/assets/dashboard-card.png';
import miniStats from '@/assets/mini-stats.png';
import notificationBadge from '@/assets/notification-badge.png';
import {
  BuildingIcon,
  GlobeIcon,
  StarIcon,
} from './icons';

/*
 * Marketing hero — the first section of the home page. Three breakpoints per
 * Figma:
 *   - mobile (<768px):  single stacked column; the dashboard preview renders
 *     inline, full-width, with no floating cards or decorative blobs.
 *   - tablet (md, 768px): centered stacked column; the visual is the full
 *     floating composition on a fixed 520×430 canvas.
 *   - desktop (lg, 1024px): two-column row — copy on the left, the floating
 *     visual on the right.
 * The floating dashboard card, mini-stats card, and notification badge come
 * from committed PNG exports; the soft blobs behind them are CSS radial
 * gradients so no extra image assets are needed.
 */

type TrustBadge = {
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
};

const TRUST_BADGES: TrustBadge[] = [
  { label: '2,500+ Companies Formed', Icon: BuildingIcon },
  { label: 'Serving 20+ Countries', Icon: GlobeIcon },
  { label: '4.9★ Client Rating', Icon: StarIcon },
];

export function HeroSection() {
  return (
    <section className="flex w-full flex-col items-start gap-10 bg-primary-light px-4 py-12 md:items-center md:gap-12 md:px-10 md:py-16 lg:flex-row lg:items-center lg:gap-16 lg:px-20 lg:py-24">
      <HeroCopy />
      <HeroVisual />
    </section>
  );
}

function HeroCopy() {
  return (
    <div className="flex w-full flex-col items-start gap-6 lg:min-w-0 lg:flex-1 lg:gap-8">
      <div className="flex w-full flex-col items-start gap-4 lg:gap-5">
        <h1 className="w-full font-marketing text-[32px] font-extrabold leading-[40px] text-text md:text-[42px] md:leading-[52px] lg:text-[56px] lg:leading-[68px]">
          Launch Your Business Anywhere in the World
        </h1>
        <p className="w-full text-[14px] leading-[22px] text-text-secondary md:text-[15px] md:leading-6 lg:text-[16px] lg:leading-[26px]">
          Form your LLC, open a business bank account, and manage your mail —
          whether you are building in the US, UK, Canada, or Europe. We handle
          the paperwork so you can focus on growth.
        </p>
      </div>

      <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row md:items-center md:gap-4">
        <a
          href="/get-started"
          className="flex items-center justify-center rounded-input bg-accent px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0px_4px_6px_rgba(228,32,97,0.2)] transition-colors hover:bg-accent-hover md:px-8 lg:text-[16px]"
        >
          Start Your LLC
        </a>
        <a
          href="/how-it-works"
          className="flex items-center justify-center rounded-input border-2 border-primary bg-white px-6 py-3.5 text-[15px] font-semibold text-primary transition-colors hover:bg-primary-light md:px-7 lg:px-8 lg:text-[16px]"
        >
          See How It Works
        </a>
      </div>

      <div className="h-px w-full bg-gray-200" />

      <div className="flex flex-wrap content-start items-start gap-2 md:gap-2.5 lg:gap-3">
        {TRUST_BADGES.map(({ label, Icon }) => (
          <div
            key={label}
            className="flex shrink-0 items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3 py-1.5 md:px-3.5 md:py-2 lg:gap-2 lg:px-4"
          >
            <Icon className="size-3.5 shrink-0 text-primary lg:size-4" />
            <span className="whitespace-nowrap text-[11px] font-semibold text-primary md:text-[12px] lg:text-[13px]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <>
      {/* Mobile: single inline dashboard card, no floating chrome. */}
      <img
        src={dashboardCard}
        alt="Analytics overview dashboard preview"
        className="w-full rounded-card shadow-[0px_10px_12px_rgba(0,0,0,0.05)] md:hidden"
      />

      {/* Tablet + desktop: floating composition on a fixed canvas. */}
      <div className="relative hidden h-[430px] w-[520px] shrink-0 md:block">
        <Blob className="left-[-10px] top-[-10px] size-24 lg:left-[-30px] lg:top-[-30px] lg:size-28" />
        <Blob className="right-[-10px] top-[-20px] size-28 lg:right-[-24px] lg:top-[-40px] lg:size-36" />
        <Blob className="bottom-[-10px] left-[-20px] size-[100px] lg:bottom-[-28px] lg:left-[-40px] lg:size-32" />
        <Blob className="bottom-[-5px] right-[-2px] size-20 lg:bottom-[-16px] lg:right-[-6px] lg:size-24" />

        <img
          src={dashboardCard}
          alt="Analytics overview dashboard preview"
          className="absolute left-1/2 top-[calc(50%+20px)] w-[416px] -translate-x-1/2 -translate-y-1/2 rounded-modal shadow-[0px_2px_3px_rgba(0,0,0,0.04),0px_18px_20px_rgba(0,0,0,0.08)] lg:left-[calc(50%-22px)] lg:top-[calc(50%+27.5px)]"
        />

        <img
          src={notificationBadge}
          alt="3 new alerts — security and billing"
          className="absolute left-[9px] top-[11px] w-[154px] drop-shadow-[0px_10px_12px_rgba(0,0,0,0.07)] lg:left-[calc(50%-260px)] lg:top-[calc(50%-215px)]"
        />

        <img
          src={miniStats}
          alt="Conversion rate 3.8%, up 4.2% vs previous period"
          className="absolute left-[348px] top-0 w-[175px] drop-shadow-[0px_10px_12px_rgba(0,0,0,0.07)] lg:left-[calc(50%+66px)] lg:top-[calc(50%-281px)]"
        />
      </div>
    </>
  );
}

// Soft indigo halo behind the floating cards — a radial gradient, no image.
function Blob({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-pill bg-[radial-gradient(circle,rgba(99,102,241,0.18)_0%,rgba(99,102,241,0)_70%)] ${className ?? ''}`}
    />
  );
}
