import { CheckIcon, CpuIcon } from '../../icons';

/*
 * The four plans, exactly as the order form offers them (`rdp_plan` in the field
 * registry). Specs only — AGENTS.md: marketing never quotes a price, and a
 * remote desktop's price moves with the term and the data centre as well as the
 * plan, so the figure belongs in the quote.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column.
 *   - tablet (md, 768px): px-10 py-14, 2-up grid.
 *   - desktop (lg, 1024px): px-20 py-20, 4-up row.
 * The Custom card is deliberately last and reads as an invitation rather than a
 * spec, because that is what the form's `custom` option is.
 */

type Plan = {
  name: string;
  specs: string[];
  note: string;
};

const PLANS: Plan[] = [
  {
    name: 'Starter',
    specs: ['2 vCPU', '4 GB RAM', '80 GB SSD'],
    note: 'One person, a browser, and the everyday tools of running a business.',
  },
  {
    name: 'Standard',
    specs: ['4 vCPU', '8 GB RAM', '160 GB SSD'],
    note: 'A working machine for a couple of people, or one person with real software open.',
  },
  {
    name: 'Pro',
    specs: ['8 vCPU', '16 GB RAM', '320 GB SSD'],
    note: 'A team logged in at once, or heavier applications that stall on smaller machines.',
  },
  {
    name: 'Custom',
    specs: ['Your specification'],
    note: 'More cores, more disk, or a shape none of the above fits — tell us and we build to it.',
  },
];

export function RdpPlansSection() {
  return (
    <section className="flex w-full flex-col items-start gap-6 bg-white px-5 py-10 md:gap-8 md:px-10 md:py-14 lg:gap-10 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          Pick the Shape of the Machine
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          Four plans, and every one of them dedicated — the resources listed are
          yours, not a share of someone else&apos;s server.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {PLANS.map(({ name, specs, note }) => (
          <article
            key={name}
            className="flex h-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:gap-5 lg:p-6"
          >
            <div className="flex w-full items-center gap-3 border-b border-gray-200 pb-3 lg:pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light lg:size-11">
                <CpuIcon className="size-[18px] text-primary lg:size-5" />
              </div>
              <h3 className="font-marketing text-[18px] font-bold leading-normal text-text lg:text-[20px]">
                {name}
              </h3>
            </div>

            <ul className="flex w-full flex-col items-start gap-2">
              {specs.map((spec) => (
                <li key={spec} className="flex w-full items-center gap-2">
                  <CheckIcon className="size-4 shrink-0 text-success" />
                  <span className="flex-1 text-[13px] font-semibold leading-normal text-text lg:text-[14px]">
                    {spec}
                  </span>
                </li>
              ))}
            </ul>

            <p className="w-full flex-1 text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
              {note}
            </p>
          </article>
        ))}
      </div>

      <p className="w-full text-[12px] font-normal leading-[18px] text-text-secondary md:text-[13px] md:leading-normal">
        Every plan comes with your choice of operating system, data centre, and
        billing period. Price depends on all four, so it is quoted in your
        dashboard rather than guessed at here.
      </p>
    </section>
  );
}
