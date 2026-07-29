import { Link } from 'react-router-dom';

import type { OrderableService } from '../../types/order-new-service';

/*
 * The "Selected services" recap strip above the detail cards — carries the Step
 * 1 choices into Step 2 so the customer sees what they're filling in for, plus a
 * "Change selection" link back to Step 1. Gray-100 fill, navy service pills.
 *
 * Responsive (matching the links):
 *   - desktop & tablet: label, pills, and the link wrap on one inline row.
 *   - mobile: the label + pills stack, with "Change selection" on its own line
 *     below (larger tap target).
 * The pills are read-only here — removing a service happens on Step 1, which the
 * link returns to.
 */

type SelectedServicesSummaryStripProps = {
  selected: OrderableService[];
  changeSelectionHref: string;
};

export function SelectedServicesSummaryStrip({
  selected,
  changeSelectionHref,
}: SelectedServicesSummaryStripProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-gray-100 p-3 md:flex-row md:flex-wrap md:items-center md:gap-x-3 md:gap-y-2 md:rounded-input md:px-4 md:py-3">
      <div className="flex flex-col gap-2 md:contents">
        <p className="text-small font-semibold text-gray-600 md:text-body">
          Selected services:
        </p>
        <div className="flex flex-wrap gap-2 md:contents">
          {selected.map((service) => (
            <span
              key={service.id}
              className="rounded-pill bg-primary-light px-3 py-1 text-small font-medium text-primary"
            >
              {service.shortName ?? service.name}
            </span>
          ))}
        </div>
      </div>

      <Link
        to={changeSelectionHref}
        className="w-fit text-body font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-small"
      >
        Change selection
      </Link>
    </div>
  );
}
