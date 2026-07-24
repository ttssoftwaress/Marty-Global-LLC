import { Check, CircleCheck } from 'lucide-react';

import type { OrderableService } from '../../types/order-new-service';
import { serviceIcon } from './serviceIcons';

/*
 * One selectable service card — the same tree at every width, with Tailwind
 * swapping the sizes the three Figma links differ on (icon chip 40/44 → 36 at
 * `md`, title 16 → 18 at `lg`, body/feature 13 → 12 at `md`, padding 20 → 24 at
 * `lg`). The whole card is the toggle, so it's a real `<button>` with
 * `aria-pressed` rather than a div with a click handler.
 *
 * Selected state: navy 2px border + primary-light fill, the icon chip inverts
 * to white, and the top-right circle fills navy with a check. Unselected: gray
 * border, primary-light chip, hollow circle. Content data (name, features,
 * footer) is all from `service` — nothing here is hardcoded catalog text.
 */

type ServiceCardProps = {
  service: OrderableService;
  selected: boolean;
  onToggle: (id: string) => void;
};

export function ServiceCard({ service, selected, onToggle }: ServiceCardProps) {
  const Icon = serviceIcon(service.iconKey);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(service.id)}
      className={`group flex h-full w-full flex-col justify-between rounded-card text-left shadow-sm-elevation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        selected
          ? 'border-2 border-primary bg-primary-light'
          : 'border border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex flex-col gap-3 p-5 md:gap-3 lg:gap-4 lg:p-card lg:pb-4">
        <div className="flex items-center justify-between">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-input md:size-9 md:rounded-[8px] lg:size-11 ${
              selected ? 'bg-white' : 'bg-primary-light'
            }`}
          >
            <Icon
              className="size-5 text-primary md:size-[18px] lg:size-5"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </span>

          {/* Selection indicator — filled navy check when on, hollow ring when off. */}
          {selected ? (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary md:size-5 lg:size-6">
              <Check
                className="size-3.5 text-white md:size-3 lg:size-3.5"
                strokeWidth={3}
                aria-hidden="true"
              />
            </span>
          ) : (
            <span className="size-6 shrink-0 rounded-full border-[1.5px] border-gray-300 md:size-5 lg:size-6" />
          )}
        </div>

        <div className="flex flex-col gap-1 lg:gap-2">
          <h3 className="text-body-lg font-semibold text-text lg:text-h6">
            {service.name}
          </h3>
          <p className="text-small leading-[1.4] text-text-secondary md:text-[12px] lg:text-[13px]">
            {service.description}
          </p>
        </div>

        <ul className="flex flex-col gap-1.5 md:gap-1.5 lg:gap-2.5">
          {service.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 md:gap-1.5 lg:gap-2">
              <CircleCheck
                className="size-4 shrink-0 text-success md:size-3.5 lg:size-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-small text-gray-700 md:text-[12px] lg:text-[13px]">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-gray-200 px-5 py-3 md:py-2.5 lg:px-card lg:py-3.5">
        <span className="text-caption font-medium uppercase text-gray-400 lg:text-[11px]">
          {service.footer.label}
        </span>
        {service.footer.chips && service.footer.chips.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {service.footer.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-[4px] bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
              >
                {chip}
              </span>
            ))}
          </span>
        )}
      </div>
    </button>
  );
}
