/*
 * FAQ page hero — the first section of the FAQ page. Text-only, matching the
 * Services and How It Works heroes so the public pages share one opening shape:
 *   - mobile (<768px):  px-5 py-8, 16px gap, 28px/1.25 heading, 14px body.
 *   - tablet (md, 768px): pt-14 pb-12 px-10, 16px gap, 36px/1.2 heading, 15px body.
 *   - desktop (lg, 1024px): pt-20 pb-16 px-20, 24px gap, 48px/1.2 heading, 16px
 *     body capped at 800px wide.
 */

export function FaqHeroSection() {
  return (
    <section className="flex w-full flex-col items-start gap-4 bg-white px-5 py-8 md:px-10 md:pb-12 md:pt-14 lg:gap-6 lg:px-20 lg:pb-16 lg:pt-20">
      <span className="inline-flex items-center rounded-pill bg-primary-light px-3.5 py-1.5 text-[10px] font-bold uppercase text-primary md:px-4 md:text-[11px]">
        Frequently Asked Questions
      </span>

      <h1 className="w-full font-marketing text-[28px] font-bold leading-[1.25] text-text md:text-[36px] md:leading-[1.2] lg:text-[48px]">
        Answers to the Questions Founders Ask Us Most
      </h1>

      <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:max-w-[800px] lg:text-[16px] lg:leading-[1.6]">
        Formation, banking, mail, and how quotes and payment work — grouped by
        topic. If your question is not here, our team answers in live chat or
        through the contact form.
      </p>
    </section>
  );
}
