import type { ReactNode } from 'react';

/*
 * "What you can ask for after delivery" — the follow-up requests a delivered
 * service accepts, each with the turnaround it carries. The catalog defines
 * these per service (`seed-catalog.ts`, `requestTypes`), and a customer should
 * know before ordering that a change is a request in their dashboard with a
 * stated turnaround rather than an email into nowhere.
 *
 * Three breakpoints: one column on mobile (px-5 py-10), 2-up at tablet
 * (px-10 py-14), `columns` across at desktop (px-20 py-20). The optional note
 * renders as a bordered strip beneath the grid — use it for the one thing a
 * customer must know before they order, not for small print.
 */

export type ServiceRequest = {
  Icon: (props: { className?: string }) => ReactNode;
  label: string;
  description: string;
  turnaround: string;
};

type ServiceRequestGridProps = {
  heading: string;
  subheading: string;
  requests: ServiceRequest[];
  columns?: 3 | 4;
  tone?: 'white' | 'gray';
  note?: { Icon: (props: { className?: string }) => ReactNode; text: string };
};

export function ServiceRequestGrid({
  heading,
  subheading,
  requests,
  columns = 4,
  tone = 'gray',
  note,
}: ServiceRequestGridProps) {
  return (
    <section
      className={`flex w-full flex-col items-start gap-6 px-5 py-10 md:gap-8 md:px-10 md:py-14 lg:gap-10 lg:px-20 lg:py-20 ${
        tone === 'gray' ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      <div className="flex w-full flex-col items-start gap-3 lg:max-w-[800px] lg:gap-4">
        <h2 className="w-full font-marketing text-[24px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-[1.2] lg:text-[40px]">
          {heading}
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] lg:text-[16px] lg:leading-[1.6]">
          {subheading}
        </p>
      </div>

      <div
        className={`grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 ${
          columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
        }`}
      >
        {requests.map(({ Icon, label, description, turnaround }) => (
          <article
            key={label}
            className="flex h-full flex-col items-start gap-3 rounded-card border border-gray-200 bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.04)] lg:gap-4 lg:p-6"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light lg:size-11">
              <Icon className="size-[18px] text-primary lg:size-5" />
            </div>
            <h3 className="w-full text-[16px] font-semibold leading-normal text-text lg:text-[17px]">
              {label}
            </h3>
            <p className="w-full flex-1 text-[13px] font-normal leading-5 text-text-secondary lg:text-[14px] lg:leading-[22px]">
              {description}
            </p>
            <span className="rounded-pill bg-primary-light px-3 py-1 text-[11px] font-semibold leading-normal text-primary lg:text-[12px]">
              {turnaround}
            </span>
          </article>
        ))}
      </div>

      {note && (
        <div
          className={`flex w-full items-start gap-2 rounded-card border border-gray-200 p-4 md:items-center lg:p-5 ${
            tone === 'gray' ? 'bg-white' : 'bg-gray-50'
          }`}
        >
          <note.Icon className="mt-0.5 size-4 shrink-0 text-accent md:mt-0" />
          <p className="flex-1 text-[13px] font-medium leading-5 text-text-secondary lg:text-[14px]">
            {note.text}
          </p>
        </div>
      )}
    </section>
  );
}
