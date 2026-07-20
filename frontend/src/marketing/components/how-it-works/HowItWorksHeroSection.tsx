/*
 * How It Works page hero — the first section of the How It Works page.
 * Text-only, no imagery. Three breakpoints per Figma:
 *   - mobile (<768px):  px-5 py-12, 20px gap, 30px/1.25 heading, 14px/1.5 body.
 *   - tablet (md, 768px): pt-16 pb-12 px-10, 20px gap, 36px/1.25 heading, 15px/1.6 body.
 *   - desktop (lg, 1024px): pt-20 pb-16 px-20, 24px gap, 48px/1.2 heading, 16px/1.6
 *     body capped at 800px wide.
 * The eyebrow is a primary-light pill; the heading uses the marketing (Poppins)
 * face; the subtitle is secondary text.
 */

export function HowItWorksHeroSection() {
  return (
    <section className="flex w-full flex-col items-start gap-5 bg-white px-5 py-12 md:px-10 md:pb-12 md:pt-16 lg:gap-6 lg:px-20 lg:pb-16 lg:pt-20">
      <span className="inline-flex items-center rounded-pill bg-primary-light px-4 py-1.5 text-[11px] font-bold uppercase text-primary">
        Our Process
      </span>

      <h1 className="w-full font-marketing text-[30px] font-bold leading-[1.25] text-text md:text-[36px] lg:text-[48px] lg:leading-[1.2]">
        From Sign-Up to Done — One Clear Process, Wherever You&apos;re Building
      </h1>

      <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] md:leading-[1.6] lg:max-w-[800px] lg:text-[16px]">
        The same simple, transparent steps whether you&apos;re launching in the
        USA, UK, Canada, or Europe.
      </p>
    </section>
  );
}
