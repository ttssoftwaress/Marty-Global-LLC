import { Check } from 'lucide-react';

import { formatOrderDate } from '../../lib/format';
import type { OrderTimeline } from '../../types/orders';
import { SectionCard } from './SectionCard';

/*
 * Order process timeline — the five-stage lifecycle of an order. One data
 * model (steps + currentIndex), two presentations swapped by breakpoint, since
 * a horizontal stepper cannot reflow into a vertical one:
 *   - mobile:        vertical rail — node + connector down the left, text right
 *   - tablet/desktop: horizontal stepper — connector line through the nodes
 *
 * Each node's look comes from its state relative to the current step: a done
 * step is a filled navy circle with a check, the current step is a ringed
 * hollow circle, an upcoming step is a bordered circle with its 1-based number.
 * The design shows brand navy for done/current; the amber accent ring in the
 * desktop link is folded into the brand ring here so the stepper stays on-token.
 */

function stepState(index: number, currentIndex: number) {
  if (index < currentIndex) return 'done' as const;
  if (index === currentIndex) return 'current' as const;
  return 'upcoming' as const;
}

// A step's date field is either an ISO date (formatted) or a free-text estimate
// label the backend already phrased ("Est. 5–7 business days", "Pending").
function stepDate(date: string | undefined) {
  if (!date) return null;
  const isIso = /^\d{4}-\d{2}-\d{2}/.test(date);
  return isIso ? formatOrderDate(date) : date;
}

function StepNode({
  state,
  number,
}: {
  state: 'done' | 'current' | 'upcoming';
  number: number;
}) {
  if (state === 'done') {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="size-8 shrink-0 rounded-full border-[6px] border-primary bg-white" />
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-small font-semibold text-gray-400">
      {number}
    </span>
  );
}

export function OrderTimelineCard({ timeline }: { timeline: OrderTimeline }) {
  const { steps, currentIndex } = timeline;

  return (
    <SectionCard title="Order process timeline" className="gap-5 md:gap-6">
      {/* Mobile — vertical rail */}
      <ol className="flex flex-col md:hidden">
        {steps.map((step, index) => {
          const state = stepState(index, currentIndex);
          const isLast = index === steps.length - 1;
          const date = stepDate(step.date);
          return (
            <li key={step.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <StepNode state={state} number={index + 1} />
                {!isLast && (
                  <span
                    className={`w-0.5 flex-1 ${index < currentIndex ? 'bg-primary' : 'bg-gray-200'}`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className={`flex flex-col gap-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                <p
                  className={`text-body font-semibold ${state === 'upcoming' ? 'text-text-secondary' : 'text-text'}`}
                >
                  {step.label}
                </p>
                {date && (
                  <p
                    className={`text-small ${state === 'upcoming' ? 'text-gray-400' : 'text-text-secondary'}`}
                  >
                    {date}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Tablet & desktop — horizontal stepper */}
      <ol className="hidden items-start md:flex">
        {steps.map((step, index) => {
          const state = stepState(index, currentIndex);
          const isFirst = index === 0;
          const isLast = index === steps.length - 1;
          const date = stepDate(step.date);
          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <div className="flex w-full items-center">
                <span
                  className={`h-0.5 flex-1 ${isFirst ? 'bg-transparent' : index <= currentIndex ? 'bg-primary' : 'bg-gray-200'}`}
                  aria-hidden="true"
                />
                <StepNode state={state} number={index + 1} />
                <span
                  className={`h-0.5 flex-1 ${isLast ? 'bg-transparent' : index < currentIndex ? 'bg-primary' : 'bg-gray-200'}`}
                  aria-hidden="true"
                />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <p
                  className={`text-body font-semibold ${state === 'upcoming' ? 'text-text-secondary' : 'text-text'}`}
                >
                  {step.label}
                </p>
                {date && (
                  <p
                    className={`text-small ${state === 'upcoming' ? 'text-gray-400' : 'text-text-secondary'}`}
                  >
                    {date}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-small text-gray-400">
        Estimates update as your order progresses.
      </p>
    </SectionCard>
  );
}
