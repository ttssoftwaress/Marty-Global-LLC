import type {
  OrderableService,
  ServiceFieldAnswers,
} from '../../types/order-new-service';
import { ApplicationField } from './ApplicationField';
import { serviceIcon } from './serviceIcons';

/*
 * One selected service's detail section — the design's per-service card. Header
 * is a primary-light icon badge (the service's own glyph, mapped from its icon
 * key) beside "{service name} — details"; the body is that service's fields,
 * rendered from `service.detailFields`.
 *
 * The fields grid is the main responsive difference across the three links:
 *   - desktop (lg): two columns, so a service reads as compact rows of pairs.
 *   - tablet & mobile: a single column of stacked fields.
 * Textareas, when a service defines one, span both columns so they aren't
 * cramped into half the width.
 *
 * Nothing here is hardcoded per service: the card renders whatever fields the
 * catalog attached, so a new service with its own schema needs no code change.
 */

type ServiceDetailsCardProps = {
  service: OrderableService;
  answers: ServiceFieldAnswers;
  onFieldChange: (fieldName: string, value: string) => void;
};

export function ServiceDetailsCard({
  service,
  answers,
  onFieldChange,
}: ServiceDetailsCardProps) {
  const Icon = serviceIcon(service.iconKey);
  const fields = service.detailFields ?? [];

  return (
    <section className="flex w-full flex-col gap-5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-6 lg:gap-6">
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 items-center justify-center rounded-[8px] bg-primary-light p-2">
          <Icon className="size-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="min-w-0 text-h6 font-semibold text-text md:text-h6">
          {service.name} — details
        </h2>
      </div>

      {fields.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.name}
              className={field.type === 'textarea' ? 'lg:col-span-2' : undefined}
            >
              <ApplicationField
                field={field}
                value={answers[field.name] ?? ''}
                onChange={(value) => onFieldChange(field.name, value)}
                idPrefix={service.id}
              />
            </div>
          ))}
        </div>
      ) : (
        // A service with no schema still gets a section, so the customer sees it
        // was captured — the design never shows this, it's the empty-state the
        // pathway rule asks us to cover.
        <p className="rounded-input bg-gray-50 px-4 py-3 text-body text-text-secondary">
          No extra details are needed for this service.
        </p>
      )}
    </section>
  );
}
