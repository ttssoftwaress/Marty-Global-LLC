import { X } from 'lucide-react';

import type { OrderableService } from '../../types/order-new-service';

/*
 * Desktop-only summary rail (the design's 380px right column). Lists the
 * selected services as removable navy chips, then the quote-based note, then the
 * Continue CTA. Tablet and mobile move this content into a sticky bottom bar
 * instead, so this component is hidden below `lg`.
 *
 * Empty state (not shown in the Figma link, filled per the design-pathway rule):
 * when nothing is selected, the chip stack is replaced with a short prompt and
 * Continue is disabled — there's nothing to carry into Step 2 yet.
 */

const QUOTE_NOTE =
  "You'll provide details for each selected service next. Pricing is quote-based and shared after review.";

type SelectedServicesRailProps = {
  selected: OrderableService[];
  onRemove: (id: string) => void;
  onContinue: () => void;
};

export function SelectedServicesRail({
  selected,
  onRemove,
  onContinue,
}: SelectedServicesRailProps) {
  const hasSelection = selected.length > 0;

  return (
    <aside className="hidden w-[380px] shrink-0 lg:block">
      <div className="sticky top-6 flex w-full flex-col gap-5 rounded-card border border-gray-200 bg-white p-card shadow-sm-elevation">
        <h2 className="text-h6 font-semibold text-text">Selected services</h2>

        {hasSelection ? (
          <div className="flex flex-col gap-2">
            {selected.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between gap-2 rounded-pill bg-primary-light px-4 py-2.5"
              >
                <span className="min-w-0 truncate text-body font-medium text-primary">
                  {service.shortName ?? service.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(service.id)}
                  aria-label={`Remove ${service.shortName ?? service.name}`}
                  className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-white text-primary transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-input bg-gray-50 px-4 py-3 text-body text-gray-500">
            No services selected yet. Pick one or more cards to get started.
          </p>
        )}

        <div className="h-px w-full bg-gray-200" />

        <p className="text-[13px] leading-[1.4] text-text-secondary">{QUOTE_NOTE}</p>

        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSelection}
          className="btn btn-primary w-full rounded-input disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </aside>
  );
}
