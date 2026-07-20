/*
 * About page hero — the first section of the About page. Text-only, no imagery,
 * center-aligned. Three breakpoints per Figma:
 *   - mobile (<768px):  px-4 pt-12 pb-10, 20px gap, 30px/38 heading, 14px/22 body.
 *   - tablet (md, 768px): px-10 py-20, 24px gap, 38px/48 heading, 16px/26 body.
 *   - desktop (lg, 1024px): px-20 py-24, 32px gap, 48px/58 heading capped at
 *     960px, 18px/28 body capped at 800px.
 * The eyebrow is a primary-light pill; the heading uses the marketing (Poppins)
 * face; the subtitle is secondary text.
 */

export function AboutHeroSection() {
  return (
    <section className="flex w-full flex-col items-center gap-5 bg-white px-4 pb-10 pt-12 text-center md:gap-6 md:px-10 md:py-20 lg:gap-8 lg:px-20 lg:py-24">
      <span className="inline-flex items-center rounded-pill bg-primary-light px-4 py-1.5 text-[11px] font-semibold uppercase text-primary">
        About Marty Global LLC
      </span>

      <h1 className="w-full font-marketing text-[30px] font-bold leading-[38px] text-text md:text-[38px] md:leading-[48px] lg:max-w-[960px] lg:text-[48px] lg:leading-[58px]">
        Your Trusted Partner for Global Business Formation
      </h1>

      <p className="w-full text-[14px] font-normal leading-[22px] text-text-secondary md:text-[16px] md:leading-[26px] lg:max-w-[800px] lg:text-[18px] lg:leading-[28px]">
        10,000+ companies formed across 4 regions since 2019 — helping founders
        legally establish, scale, and manage their corporate presence without
        friction.
      </p>
    </section>
  );
}
