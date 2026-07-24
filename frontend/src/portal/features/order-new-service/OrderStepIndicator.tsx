import { Fragment } from 'react';
import { Check } from 'lucide-react';

/*
 * The two-step wizard progress indicator, shared across viewports with two
 * presentations the design calls for:
 *   - md+ (tablet, desktop): numbered badges joined by a connector line. A step
 *     already passed shows a navy badge with a check and a muted label; the
 *     current step shows a navy badge with its number and a dark label; later
 *     steps are hollow gray.
 *   - mobile: a "Step N of M — <label>" caption over a filled progress bar.
 *
 * Steps are data so a future third step needs no layout change; `currentStep`
 * is 1-based.
 */

const STEPS = ['Select services', 'Application details'];

type OrderStepIndicatorProps = {
  currentStep: number; // 1-based
};

export function OrderStepIndicator({ currentStep }: OrderStepIndicatorProps) {
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
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                    filled
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
                <span
                  className={`whitespace-nowrap text-body font-medium ${
                    isCurrent ? 'text-text' : isDone ? 'text-text-secondary' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
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
            className="h-full rounded-pill bg-primary transition-[width]"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}
