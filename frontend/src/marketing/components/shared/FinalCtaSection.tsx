/*
 * Final CTA — the closing section of the home page, a full-width navy band
 * inviting sign-up. Three breakpoints per Figma:
 *   - mobile (<768px):  heading 26px, buttons stacked full-width in a column.
 *   - tablet (md, 768px): heading 32px, buttons back in a centered row.
 *   - desktop (lg, 1024px): heading 40px on an 800px copy block, roomier padding.
 * The band and accent-button drop shadows are brand-tinted elevations that sit
 * outside the shared shadow scale, so they stay as arbitrary values here.
 */

export function FinalCtaSection() {
  return (
    <section className="flex w-full flex-col items-center gap-8 bg-secondary px-4 py-16 shadow-[0px_12px_24px_rgba(3,18,109,0.2)] md:gap-7 md:px-10 md:py-[72px] lg:gap-8 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-center gap-3 text-center md:gap-[14px] lg:w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[26px] font-bold leading-[34px] text-white md:text-[32px] md:leading-tight lg:text-[40px]">
          Ready to Launch Your Global Business?
        </h2>
        <p className="w-full text-[14px] leading-5 text-primary-light md:text-[15px] md:leading-normal lg:text-[16px]">
          Join thousands of modern founders pushing standard boundaries.
          Register your company today.
        </p>
      </div>

      <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row md:items-center md:gap-4">
        <a
          href="/get-started"
          className="flex items-center justify-center rounded-input bg-accent px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0px_4px_6px_rgba(228,32,97,0.2)] transition-colors hover:bg-accent-hover md:py-3 lg:px-8 lg:text-[16px]"
        >
          Get Started Today
        </a>
        <a
          href="/contact"
          className="flex items-center justify-center rounded-input border-2 border-white px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 md:py-3 lg:px-8 lg:text-[16px]"
        >
          Talk to Our Team
        </a>
      </div>
    </section>
  );
}
