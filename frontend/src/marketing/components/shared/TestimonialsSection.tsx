import amaraAvatar from '../../../assets/testimonial-amara.png';
import hassanAvatar from '../../../assets/testimonial-hassan.png';
import jonathanAvatar from '../../../assets/testimonial-jonathan.png';

/*
 * Testimonials — shared marketing section (home + services). Three breakpoints
 * per Figma:
 *   - mobile (<768px):  heading 28px, cards stacked in a single column.
 *   - tablet (md, 768px): heading 32px, cards still stacked (wider, larger type).
 *   - desktop (lg, 1024px): heading 40px, three equal cards in a row.
 * Each card scales its quote, avatar, name, and role across the breakpoints.
 */

type Testimonial = {
  quote: string;
  avatar: string;
  name: string;
  role: string;
  location: string;
  locationShort: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      '“As a non-resident builder, setting up a US entity was initially intimidating. Marty Global LLC handled our Delaware registration and bank integration in record time.”',
    avatar: amaraAvatar,
    name: 'Amara Van De Berg',
    role: 'CEO & Founder, ScaleFlow EU',
    location: 'Netherlands',
    locationShort: 'Netherlands',
  },
  {
    quote:
      '“The virtual mailroom is pristine. I get my scans securely within hours. Incorporating our Canada subsidiary was as easy as ordering a subscription.”',
    avatar: jonathanAvatar,
    name: 'Jonathan Wright',
    role: 'Managing Director, Peak-Digital CA',
    location: 'Toronto, Canada',
    locationShort: 'Toronto, CA',
  },
  {
    quote:
      '“Unbelievable customer support. They answered our UK VAT questions instantly and set up our high-street corporate accounts without physical presence required.”',
    avatar: hassanAvatar,
    name: 'Hassan Al-Mansoori',
    role: 'Tech Operator, Oasis Fintech',
    location: 'London, UK',
    locationShort: 'London, UK',
  },
];

export function TestimonialsSection() {
  return (
    <section className="flex w-full flex-col items-center gap-10 bg-white px-4 py-16 md:gap-12 md:px-10 md:py-20 lg:gap-16 lg:px-20 lg:py-24">
      <h2 className="w-full text-center font-marketing text-[28px] font-bold leading-[1.2] text-text md:text-[32px] lg:text-[40px]">
        Trusted by Entrepreneurs Worldwide
      </h2>

      <div className="flex w-full flex-col gap-4 md:gap-5 lg:flex-row lg:items-start lg:gap-8">
        {TESTIMONIALS.map((testimonial) => (
          <TestimonialCard key={testimonial.name} {...testimonial} />
        ))}
      </div>
    </section>
  );
}

function TestimonialCard({
  quote,
  avatar,
  name,
  role,
  location,
  locationShort,
}: Testimonial) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-6 shadow-[0px_4px_8px_rgba(17,24,39,0.03)] md:gap-5 md:p-7 lg:min-w-0 lg:flex-1 lg:gap-6 lg:p-8">
      <p className="w-full text-[13px] italic leading-5 text-gray-800 md:text-[14px] md:leading-[22px] lg:text-[15px] lg:leading-6">
        {quote}
      </p>

      <div className="flex w-full items-center gap-2.5 md:gap-3">
        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-primary-light lg:size-12">
          <img
            src={avatar}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="w-full text-[13px] font-bold leading-tight text-text md:text-[14px]">
            {name}
          </p>
          <p className="w-full text-[11px] leading-tight text-text-secondary md:text-[12px]">
            {role} ·{' '}
            <span className="font-semibold text-accent">
              <span className="md:hidden">{locationShort}</span>
              <span className="hidden md:inline">{location}</span>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
