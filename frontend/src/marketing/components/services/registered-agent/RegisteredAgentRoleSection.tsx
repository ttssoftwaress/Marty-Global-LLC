import { CheckIcon, ShieldCheckIcon } from '../../icons';

/*
 * What the appointment actually is — the explanation on the left, and on the
 * right the consequence card: what a state does when it cannot reach your agent.
 * Mirrors the mail room page's uses section, which is the layout for "one thing
 * explained, one distinction drawn".
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-5 py-10, single column, the card below the copy.
 *   - tablet (md, 768px): px-10 py-14, still stacked, roomier type.
 *   - desktop (lg, 1024px): px-20 py-20, copy left / card right.
 *
 * The closing note is the AGENTS.md rule in the place it matters most on this
 * page: describing what a state requires is not advice about what your company
 * should do, and this page must not read as the latter.
 */

const DUTIES = [
  'Receives service of process — the papers filed when someone sues the company — at a physical address in the state of registration',
  'Receives the state’s own correspondence: annual report notices, franchise tax letters, and compliance reminders',
  'Is available at that address during business hours, which is the part a founder in another time zone cannot cover',
  'Appears on the public register, which is why the address you use is a decision you make once and live with',
];

const LAPSE_CONSEQUENCES = [
  {
    title: 'Loss of good standing',
    body: 'A state that cannot reach your agent marks the company as not in good standing — the status banks and marketplaces check before they approve you.',
  },
  {
    title: 'Deadlines you never saw',
    body: 'Legal papers are served whether or not anyone collects them. A missed response window is not reopened because the notice went to an address nobody watches.',
  },
  {
    title: 'Administrative dissolution',
    body: 'Left long enough, states move to dissolve the entity themselves. Reinstating one costs more time and more fees than the appointment ever did.',
  },
];

export function RegisteredAgentRoleSection() {
  return (
    <section className="flex w-full flex-col items-start gap-7 bg-gray-50 px-5 py-10 md:gap-9 md:px-10 md:py-14 lg:flex-row lg:items-start lg:gap-16 lg:px-20 lg:py-20">
      <div className="flex w-full flex-col items-start gap-5 lg:flex-1 lg:gap-7">
        <div className="flex w-full flex-col items-start gap-3 lg:gap-4">
          <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
            What a Registered Agent Actually Does
          </h2>
          <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
            Every US state requires a registered entity to name one. It is the
            contact the state serves papers on — and the one obligation that
            keeps running whether or not the business is trading.
          </p>
        </div>

        <ul className="flex w-full flex-col items-start gap-3 lg:gap-3.5">
          {DUTIES.map((duty) => (
            <li key={duty} className="flex w-full items-start gap-2.5">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
              <span className="flex-1 text-[13px] font-normal leading-5 text-text-secondary md:text-[14px] lg:leading-[22px]">
                {duty}
              </span>
            </li>
          ))}
        </ul>

        <p className="w-full text-[12px] font-medium leading-[18px] text-text-secondary md:text-[13px] md:leading-5">
          This describes what states require, not what your company should do —
          Marty Global is a filing service provider, not a law firm, and does not
          give legal or tax advice.
        </p>
      </div>

      <aside className="flex w-full flex-col items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:w-[420px] lg:shrink-0 lg:gap-5 lg:p-7">
        <div className="flex w-full items-center gap-2.5 border-b border-gray-200 pb-3 lg:pb-4">
          <ShieldCheckIcon className="size-5 shrink-0 text-accent" />
          <h3 className="font-marketing text-[16px] font-bold leading-normal text-text lg:text-[18px]">
            When the Appointment Lapses
          </h3>
        </div>

        {LAPSE_CONSEQUENCES.map((entry) => (
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
          None of it is dramatic on the day it happens — which is exactly why it
          gets missed. Your dashboard carries the renewal date so it does not.
        </p>
      </aside>
    </section>
  );
}
