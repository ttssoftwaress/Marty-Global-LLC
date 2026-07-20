/*
 * Contact page hero — the first section of the Contact page. Text-only, no
 * imagery, left-aligned, sitting on a gray-50 band with a bottom border. Three
 * breakpoints per Figma:
 *   - mobile (<768px):  px-4 py-10, 16px gap, 28px/36 heading, 14px/22 body.
 *   - tablet (md, 768px): px-10 pt-12 pb-8, 16px gap, 36px heading (normal
 *     leading), 15px/24 body.
 *   - desktop (lg, 1024px): px-20 pt-16 pb-10, 16px gap, 48px heading (normal
 *     leading), 16px/26 body capped at 700px.
 * The eyebrow is a gray-400 uppercase breadcrumb; the heading uses the
 * marketing (Poppins) face; the subtitle is secondary text.
 */

export function ContactHeroSection() {
  return (
    <section className="flex w-full flex-col items-start gap-4 border-b border-gray-200 bg-gray-50 px-4 py-10 md:px-10 md:pb-8 md:pt-12 lg:px-20 lg:pb-10 lg:pt-16">
      <p className="text-[12px] font-semibold uppercase text-gray-400">
        Home / Get Started
      </p>

      <h1 className="font-marketing text-[28px] font-bold leading-[36px] text-text md:text-[36px] md:leading-normal lg:text-[48px]">
        Launch Your Global Business in Minutes
      </h1>

      <p className="text-[14px] font-normal leading-[22px] text-text-secondary md:text-[15px] md:leading-[24px] lg:max-w-[700px] lg:text-[16px] lg:leading-[26px]">
        Create your company, set up virtual mail, open bank accounts, and launch
        e-commerce across the USA, UK, Canada, and Europe — our expert team
        reviews every application personally.
      </p>
    </section>
  );
}
