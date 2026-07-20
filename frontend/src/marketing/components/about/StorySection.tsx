import storyBuilding from '@/assets/story-building.png';

/*
 * Our Story — the third section of the About page. Text + image, then a stat
 * row. Sits on a white surface. Three breakpoints per Figma:
 *   - mobile (<768px):  px-4 py-10, 32px section gap; text/image stacked in a
 *     20px-gap column (16px text gap), image full-width 200px tall, 12px radius;
 *     26px heading, 14px/22 body; stats 2×2 grid, 12px gap, 18px padding, 12px
 *     radius, sm shadow, 24px value, 13px label.
 *   - tablet (md, 768px): px-10 py-20, 48px section gap; text/image stacked in a
 *     32px-gap column (16px text gap), image full-width 280px tall, 12px radius;
 *     32px heading, 15px/24 body; stats 2×2 grid, 16px gap, 20px padding, 12px
 *     radius, Gray-200 border, 24px value, 13px label.
 *   - desktop (lg, 1024px): px-20 py-24, 48px section gap; text/image in a row
 *     with 64px gap (24px text gap), image fixed 480×340, 16px radius; 40px
 *     heading, 16px/26 body; stats 1×4 row, 24px gap, 24px padding, 16px radius,
 *     sm shadow, 32px value, 14px label.
 * The heading uses the marketing (Poppins) face in primary text; the body is
 * secondary text; stat values are brand primary, stat labels secondary.
 */

const STATS = [
  { value: '7+ Years', label: 'Industry Experience' },
  { value: '4 Regions', label: 'Active Operations' },
  { value: '10,000+', label: 'Companies Formed' },
  { value: '98%', label: 'Client Satisfaction' },
];

export function StorySection() {
  return (
    <section className="flex w-full flex-col items-start gap-8 bg-white px-4 py-10 md:gap-12 md:px-10 md:py-20 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-start gap-5 md:gap-8 lg:flex-row lg:items-start lg:gap-16">
        <div className="flex w-full flex-col items-start gap-4 lg:flex-1 lg:gap-6">
          <h2 className="w-full font-marketing text-[26px] font-bold leading-normal text-text md:text-[32px] lg:text-[40px]">
            Our Story
          </h2>
          <p className="w-full text-[14px] font-normal leading-[22px] text-text-secondary md:text-[15px] md:leading-6 lg:text-[16px] lg:leading-[26px]">
            Mart Global LLC was founded by international builders who experienced
            first-hand the steep uphill battle of incorporating a business and
            getting reliable corporate bank accounts from outside the
            traditional financial hubs. The process was slow, opaque, expensive,
            and filled with arbitrary rejections.
          </p>
          <p className="w-full text-[14px] font-normal leading-[22px] text-text-secondary md:text-[15px] md:leading-6 lg:text-[16px] lg:leading-[26px]">
            We saw an opportunity to change that. By partnering directly with
            licensed state agents, established commercial banks, and global
            payment processors, we engineered a clean compliance framework that
            opens key trade doors inside the US, UK, Canada, and Europe for
            digital entrepreneurs worldwide.
          </p>
        </div>

        <div className="h-[200px] w-full shrink-0 overflow-hidden rounded-xl md:h-[280px] lg:h-[340px] lg:w-[480px] lg:rounded-card">
          <img
            src={storyBuilding}
            alt=""
            className="size-full object-cover"
          />
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 lg:gap-6">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-start gap-1 rounded-xl bg-white p-[18px] shadow-sm-elevation md:gap-2 md:rounded-xl md:border md:border-gray-200 md:p-5 lg:gap-2 lg:rounded-card lg:border-0 lg:p-6"
          >
            <p className="font-marketing text-[24px] font-bold text-primary lg:text-[32px]">
              {stat.value}
            </p>
            <p className="text-[13px] font-medium leading-[1.4] text-text-secondary lg:text-[14px]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
