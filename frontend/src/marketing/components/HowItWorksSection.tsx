/*
 * How It Works — the third section of the home page. Four numbered steps, three
 * breakpoints per Figma:
 *   - mobile (<768px):  single stacked column of white bordered cards; each card
 *     wraps a small (40px) numbered circle over its title and body.
 *   - tablet (md, 768px): a 2×2 wrapped grid of plain step columns (no card
 *     chrome), 52px circles.
 *   - desktop (lg, 1024px): all four steps in a single row of plain columns,
 *     56px circles with a soft navy drop shadow.
 * The numbered circle, title, and body scale across the breakpoints.
 */

type Step = {
  number: number;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Choose Your Package',
    description:
      'Select LLC jurisdiction and auxiliary banking/mail room services suited for your project.',
  },
  {
    number: 2,
    title: 'Submit Your Details',
    description:
      'Provide basic business details and ID through our encrypted secure portal under 10 minutes.',
  },
  {
    number: 3,
    title: 'We File & Register',
    description:
      'Our regulatory experts file directly with government registries in the US, UK, Canada, or Europe.',
  },
  {
    number: 4,
    title: 'Receive Your Documents',
    description:
      'Get digital and certified hard copies of your formation deeds, tax numbers, and bank access.',
  },
];

export function HowItWorksSection() {
  return (
    <section className="flex w-full flex-col items-center gap-10 bg-gray-50 px-4 py-16 md:gap-12 md:px-10 md:py-20 lg:gap-16 lg:px-20 lg:py-24">
      <div className="flex w-full flex-col items-center gap-2.5 text-center md:gap-3">
        <h2 className="w-full font-marketing text-[28px] font-bold leading-[1.2] text-text md:text-[32px] lg:text-[40px]">
          How It Works
        </h2>
        <p className="w-full text-[14px] leading-normal text-text-secondary md:text-[15px] lg:text-[16px]">
          Four simple steps to get your global operations legally settled
        </p>
      </div>

      <div className="flex w-full flex-col gap-6 md:flex-row md:flex-wrap md:items-start md:justify-center md:gap-6 lg:flex-nowrap lg:justify-between">
        {STEPS.map((step) => (
          <StepCard key={step.number} {...step} />
        ))}
      </div>
    </section>
  );
}

function StepCard({ number, title, description }: Step) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[12px] border border-gray-200 bg-white p-5 text-center md:w-[332px] md:gap-3.5 md:rounded-none md:border-0 md:bg-transparent md:p-0 lg:w-[260px] lg:gap-4">
      <div className="flex size-10 items-center justify-center rounded-pill bg-primary drop-shadow-[0px_4px_4px_rgba(3,18,109,0.1)] md:size-[52px] md:drop-shadow-none lg:size-14 lg:drop-shadow-[0px_4px_6px_rgba(3,18,109,0.15)]">
        <span className="font-marketing text-[16px] font-bold leading-none text-white md:text-[18px] lg:text-[20px]">
          {number}
        </span>
      </div>

      <div className="flex w-full flex-col items-center gap-1 md:gap-1.5 lg:gap-2">
        <h3 className="w-full font-marketing text-[16px] font-semibold leading-[1.2] text-text lg:text-[18px]">
          {title}
        </h3>
        <p className="w-full text-[12px] leading-[18px] text-text-secondary md:text-[13px] lg:text-[14px] lg:leading-5">
          {description}
        </p>
      </div>
    </div>
  );
}
