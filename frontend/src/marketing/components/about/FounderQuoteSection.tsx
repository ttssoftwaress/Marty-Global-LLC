import founderPortrait from '@/assets/founder-portrait.png';

/*
 * Founder's Quote — the sixth section of the About page. A single centered
 * quote card on a white surface: round portrait, italic quote, then the
 * founder signature. Three breakpoints per Figma:
 *   - mobile (<768px):  px-4 py-10; full-width card, gray-50 fill, 16px radius,
 *     sm shadow, 24px padding, 20px inner gap; 80px avatar; 16px/26 italic
 *     quote; sig column 2px gap, 14px name, 12px role.
 *   - tablet (md, 768px): px-10 py-20; full-width card, gray-50 fill, 12px
 *     radius, Gray-200 border, sm shadow, 32px padding, 24px inner gap; 80px
 *     avatar; 18px/28 italic quote; sig column 4px gap, 15px name, 13px role.
 *   - desktop (lg, 1024px): px-20 py-24; card centered and capped at 960px,
 *     gray-50 fill, 16px radius, lg shadow, 48px padding, 32px inner gap; 96px
 *     avatar; 20px/32 italic quote; sig column 4px gap, 16px name, 14px role.
 * The quote is italic secondary-face body in primary text; the name uses the
 * marketing (Poppins) face in primary text, the role is secondary text.
 */

export function FounderQuoteSection() {
  return (
    <section className="flex w-full flex-col items-start bg-white px-4 py-10 md:items-center md:px-10 md:py-20 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-center gap-5 rounded-card bg-gray-50 p-6 shadow-sm-elevation md:gap-6 md:rounded-xl md:border md:border-gray-200 md:p-8 lg:w-[960px] lg:gap-8 lg:rounded-card lg:border-0 lg:p-12 lg:shadow-lg-elevation">
        <div className="size-20 shrink-0 overflow-hidden rounded-full lg:size-24">
          <img src={founderPortrait} alt="" className="size-full object-cover" />
        </div>

        <p className="w-full text-center text-[16px] font-normal italic leading-[26px] text-text md:text-[18px] md:leading-[28px] lg:text-[20px] lg:leading-8">
          &quot;Our mission isn&apos;t just about filing paperwork. It&apos;s
          about opening the door for people who want to build amazing things but
          don&apos;t happen to reside inside one of the traditional corporate
          corridors. By removing the friction, we unlock the next 10,000 great
          companies.&quot;
        </p>

        <div className="flex flex-col items-center gap-0.5 lg:gap-1">
          <p className="font-marketing text-[14px] font-bold text-text md:text-[15px] lg:text-[16px]">
            Marcus Aurelius
          </p>
          <p className="text-[12px] font-normal text-text-secondary md:text-[13px] lg:text-[14px]">
            Founder &amp; CEO, Mart Global LLC
          </p>
        </div>
      </div>
    </section>
  );
}
