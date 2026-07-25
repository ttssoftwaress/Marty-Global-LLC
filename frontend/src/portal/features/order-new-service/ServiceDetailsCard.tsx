import type {
  OrderableService,
  ServiceField,
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
  /*
   * The fields to render. Defaults to the service's flat schema, so a caller
   * that doesn't deal in steps keeps the original behaviour; the stepped flow
   * passes one step's fields instead.
   */
  fields?: ServiceField[];
  // The step's own title/description, when the admin has split the form. Absent
  // for a flat service, where the heading is just "{service} — details".
  stepTitle?: string;
  stepDescription?: string;
  stepIndex?: number;
  stepCount?: number;
};

export function ServiceDetailsCard({
  service,
  answers,
  onFieldChange,
  fields: fieldsProp,
  stepTitle,
  stepDescription,
  stepIndex,
  stepCount,
}: ServiceDetailsCardProps) {
  const Icon = serviceIcon(service.iconKey);
  const fields = fieldsProp ?? service.detailFields ?? [];

  // A service split into more than one step names the step in the heading, so
  // the customer can tell two screens of the same service apart.
  const showStepMeta =
    typeof stepCount === 'number' && stepCount > 1 && typeof stepIndex === 'number';

  return (
    <section className="flex w-full flex-col gap-5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-6 lg:gap-6">
      <div className="flex items-start gap-3">
        <span className="flex shrink-0 items-center justify-center rounded-[8px] bg-primary-light p-2">
          <Icon className="size-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          {showStepMeta ? (
            <span className="text-caption font-medium uppercase tracking-[0.4px] text-text-secondary">
              {service.shortName ?? service.name} — step {stepIndex + 1} of{' '}
              {stepCount}
            </span>
          ) : null}

          <h2 className="min-w-0 text-h6 font-semibold text-text">
            {stepTitle ?? `${service.name} — details`}
          </h2>

          {stepDescription ? (
            <p className="text-body text-text-secondary">{stepDescription}</p>
          ) : null}
        </div>
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
