import { Fragment } from 'react';
import { Check } from 'lucide-react';

/*
 * The wizard progress indicator, shared across viewports with two presentations
 * the design calls for:
 *   - md+ (tablet, desktop): numbered badges joined by a connector line. A step
 *     already passed shows a navy badge with a check and a muted label; the
 *     current step shows an accent badge with its number and a dark label
 *     (the design drew it navy — magenta marks "you are here" as part of the
 *     accent-visibility pass, logged as a deviation); later steps are hollow
 *     gray.
 *   - mobile: a "Step N of M — <label>" caption over a filled progress bar.
 *
 * The step list is a prop rather than a constant, because how many steps an
 * application has is admin-defined per service: a service whose request form is
 * split into three steps produces a five-step flow (select, three, submitted-1),
 * and the indicator has to say so. `currentStep` is 1-based.
 *
 * The labels are elided on md+ once the flow grows past four steps, so a long
 * configuration doesn't overflow the header row — the numbered badges still
 * carry the position, and the mobile caption always names the current step.
 */

const DEFAULT_STEPS = ['Select services', 'Application details'];

type OrderStepIndicatorProps = {
  currentStep: number; // 1-based
  steps?: string[];
};

export function OrderStepIndicator({
  currentStep,
  steps = DEFAULT_STEPS,
}: OrderStepIndicatorProps) {
  const STEPS = steps.length > 0 ? steps : DEFAULT_STEPS;
  const hideLabels = STEPS.length > 4;

  return (
    <>
      {/* md+ — numbered badges + connectors */}
      <div className="hidden items-center gap-3 md:flex">
        {STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isDone = stepNumber < currentStep;
          const filled = isCurrent || isDone;

          return (
            <Fragment key={label}>
              {index > 0 && <span className="h-px w-10 bg-gray-300" aria-hidden="true" />}
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold ${
                    isCurrent
                      ? 'bg-accent text-white'
                      : filled
                        ? 'bg-primary text-white'
                        : 'border-[1.5px] border-gray-300 text-gray-400'
                  }`}
                >
                  {isDone ? (
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    stepNumber
                  )}
                </span>
                {hideLabels && !isCurrent ? null : (
                  <span
                    className={`whitespace-nowrap text-body font-medium ${
                      isCurrent ? 'text-text' : isDone ? 'text-text-secondary' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* mobile — caption + progress bar */}
      <div className="flex w-full flex-col gap-2 md:hidden">
        <p className="text-small font-medium text-text-secondary">
          Step {currentStep} of {STEPS.length} — {STEPS[currentStep - 1]}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-pill bg-gray-200">
          <div
            className="h-full rounded-pill bg-accent transition-[width]"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}
