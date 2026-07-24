import { X } from 'lucide-react';

import type { OrderableService } from '../../types/order-new-service';

/*
 * The mobile + tablet sticky action bar — the tablet and mobile links both pin
 * this to the bottom of the viewport in place of the desktop rail. Two layouts,
 * swapped at `md`:
 *   - mobile: "<N> selected" on the left, Continue on the right.
 *   - tablet: removable selected-service chips + "Pricing is quote-based." on the
 *     left, a fixed-width Continue on the right.
 *
 * It's `sticky bottom-0` inside the scrolling workspace rather than fixed, so it
 * rides above the content without overlapping the sidebar. Hidden at `lg`, where
 * the desktop rail takes over. Continue is disabled with nothing selected.
 */

type OrderStickyBarProps = {
  selected: OrderableService[];
  onRemove: (id: string) => void;
  onContinue: () => void;
};

export function OrderStickyBar({
  selected,
  onRemove,
  onContinue,
}: OrderStickyBarProps) {
  const count = selected.length;
  const hasSelection = count > 0;

  return (
    <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.08)] md:px-6 md:py-4 lg:hidden">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* mobile — count only */}
          <p className="text-body font-medium text-text md:hidden">
            {count} selected
          </p>

          {/* tablet — chips + quote note */}
          <div className="hidden min-w-0 flex-col gap-1.5 md:flex">
            {hasSelection && (
              <div className="flex flex-wrap gap-2">
                {selected.map((service) => (
                  <span
                    key={service.id}
                    className="flex items-center gap-1.5 rounded-pill bg-primary-light px-2.5 py-1 text-[12px] font-medium text-primary"
                  >
                    {service.shortName ?? service.name}
                    <button
                      type="button"
                      onClick={() => onRemove(service.id)}
                      aria-label={`Remove ${service.shortName ?? service.name}`}
                      className="flex size-[14px] items-center justify-center rounded-full text-primary transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[12px] text-gray-500">Pricing is quote-based.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSelection}
          className="btn btn-primary shrink-0 rounded-input px-6 md:w-[200px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
