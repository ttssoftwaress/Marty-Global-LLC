import { CheckIcon, ShieldCheckIcon } from '../../icons';

/*
 * What the address is for — the uses on the left, and on the right the one
 * distinction customers get wrong: a Registered Agent address is not a business
 * address. The formation page includes an agent; this page sells the address
 * you actually hand out, and confusing them is what leads to mail nobody
 * forwards.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column, the comparison card below.
 *   - tablet (md, 768px): px-10 py-14, still stacked, roomier type.
 *   - desktop (lg, 1024px): px-20 py-20, copy left / comparison card right.
 */

const USES = [
  'The registered office or business address on your company filing, where the registry accepts a commercial address',
  'The address on bank and payment-provider applications, which are checked against your formation documents',
  'Marketplace seller verification — Amazon, eBay, Walmart, and Alibaba all check a local address',
  'The contact address on invoices, contracts, and your website, so your home address stays private',
];

const COMPARISON = [
  {
    title: 'Registered Agent',
    body: 'Receives official state notices and legal service on the company’s behalf, during business hours, in the state where you filed. Included for a year with every US formation.',
  },
  {
    title: 'Virtual Mail Room',
    body: 'Receives everything else — bank letters, platform verification post, supplier and customer mail, packages — scans it, and forwards or shreds it on your instruction.',
  },
];

export function MailRoomUsesSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-gray-50 px-5 py-10 md:gap-9 md:px-10 md:py-14 lg:flex-row lg:items-start lg:gap-16 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-5 lg:flex-1 lg:gap-7">
        <div className="flex w-full flex-col items-start gap-3 lg:gap-4">
          <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
            Where You Will Actually Use It
          </h2>
          <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
            A remote business still has to give someone an address. This is the
            one you give them.
          </p>
        </div>

        <ul className="flex w-full flex-col items-start gap-3 lg:gap-3.5">
          {USES.map((use) => (
            <li key={use} className="flex w-full items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
              <span className="flex-1 text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] lg:leading-[22px]">
                {use}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <aside className="flex w-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:w-[420px] lg:shrink-0 lg:gap-5 lg:p-7">
        <div className="flex w-full items-center gap-2.5 border-b border-gray-200 pb-3 lg:pb-4">
          <ShieldCheckIcon className="size-5 shrink-0 text-accent" />
          <h3 className="font-marketing text-[16px] font-bold leading-normal text-text lg:text-[18px]">
            Not the Same as a Registered Agent
          </h3>
        </div>

        {COMPARISON.map((entry) => (
          <div key={entry.title} className="flex w-full flex-col items-start gap-1.5">
            <p className="text-[12px] font-bold uppercase leading-normal text-primary lg:text-[13px]">
              {entry.title}
            </p>
            <p className="w-full text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
              {entry.body}
            </p>
          </div>
        ))}

        <p className="w-full border-t border-gray-200 pt-3 text-[12px] font-medium leading-[18px] text-text-secondary lg:pt-4 lg:text-[13px] lg:leading-5">
          Most founders end up with both: the agent satisfies the state, the mail
          room handles the post.
        </p>
      </aside>
    </section>
  );
}
