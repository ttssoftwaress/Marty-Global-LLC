import missionGlobe from '@/assets/mission-globe.png';

/*
 * Our Mission — the second section of the About page. Two-column on desktop
 * (text left, globe art right), stacked on smaller viewports. Sits on a Gray-50
 * surface. Three breakpoints per Figma:
 *   - mobile (<768px):  px-4 py-10, column, 16px gap; 26px heading, 15px/24 lead,
 *     13px/20 note; image full-width, 200px tall, 12px radius.
 *   - tablet (md, 768px): px-10 py-20, column, 32px gap between text and image
 *     (16px gap within text); 32px heading, 16px/26 lead, 14px note; image
 *     full-width, 280px tall, 12px radius.
 *   - desktop (lg, 1024px): px-20 py-24, row, 64px gap; 24px text gap; 40px
 *     heading, 18px/28 lead, 14px/22 note; image fixed 480×320, 16px radius.
 * The heading uses the marketing (Poppins) face in brand primary; the lead is
 * primary text, the note is secondary text.
 */

export function MissionSection() {
  return (
    <section className="flex w-full flex-col items-start gap-8 bg-gray-50 px-4 py-10 md:gap-8 md:px-10 md:py-20 lg:flex-row lg:items-center lg:gap-16 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-start gap-4 lg:flex-1 lg:gap-6">
        <h2 className="w-full font-marketing text-[26px] font-bold leading-normal text-primary md:text-[32px] lg:text-[40px]">
          Our Mission
        </h2>
        <p className="w-full text-[15px] font-normal leading-6 text-text md:text-[16px] md:leading-[26px] lg:text-[18px] lg:leading-[28px]">
          To dismantle the geographical, financial, and logistical barriers that
          prevent global builders from succeeding. We believe every great idea
          deserves a solid, legal, and functional corporate foundation — no
          matter where the founder is physically located.
        </p>
        <p className="w-full text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] md:leading-normal lg:leading-[22px]">
          Through absolute automation backed by dedicated legal-ops expertise, we
          streamline the administrative friction of entity formation, regional
          banking setups, and strict international tax compliances.
        </p>
      </div>

      <div className="h-[200px] w-full shrink-0 overflow-hidden rounded-xl md:h-[280px] lg:h-[320px] lg:w-[480px] lg:rounded-card">
        <img
          src={missionGlobe}
          alt=""
          className="size-full object-cover"
        />
      </div>
    </section>
  );
}
