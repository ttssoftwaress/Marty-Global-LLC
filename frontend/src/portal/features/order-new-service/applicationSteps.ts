import type {
  OrderableService,
  ServiceField,
  ServiceFieldAnswers,
  ServiceFormStep,
} from '../../types/order-new-service';

/*
 * Turning the admin's per-service form configuration into the screens Step 2
 * actually renders.
 *
 * The catalog gives each service either a flat `detailFields` list or, once an
 * admin has split it, a `formSteps` list. `serviceFormSteps` collapses the two
 * so nothing downstream branches on which shape came back — a flat service reads
 * as one step holding every field.
 *
 * `buildApplicationSteps` then interleaves the selected services: an application
 * for two services, each with two configured steps, is a four-screen flow. Each
 * screen knows which service it belongs to, so answers stay keyed by service id
 * exactly as the single-screen version stored them and the submit payload is
 * unchanged.
 */

// The flat-schema fallback's step title, used when a service has no configured
// steps and its fields therefore render as one unnamed group.
const FLAT_STEP_TITLE = 'Application details';

export function serviceFormSteps(service: OrderableService): ServiceFormStep[] {
  const steps = service.formSteps ?? [];
  if (steps.length > 0) return steps;

  const fields = service.detailFields ?? [];
  if (fields.length === 0) return [];

  return [{ key: 'details', title: FLAT_STEP_TITLE, fields }];
}

/*
 * One screen of the application: a service and the step of its form being asked
 * for. `stepIndex` / `stepCount` are that service's own position, so a card can
 * say "Step 2 of 3" for a service without knowing the whole flow's length.
 */
export type ApplicationStep = {
  key: string;
  service: OrderableService;
  step: ServiceFormStep;
  stepIndex: number;
  stepCount: number;
};

export function buildApplicationSteps(
  services: OrderableService[],
): ApplicationStep[] {
  return services.flatMap((service) => {
    const steps = serviceFormSteps(service);

    return steps.map((step, index) => ({
      // Service id and step key together — two services can each have a step
      // keyed "entity-details" without colliding.
      key: `${service.id}:${step.key}`,
      service,
      step,
      stepIndex: index,
      stepCount: steps.length,
    }));
  });
}

// Every required field on a step has a non-empty answer. Optional fields never
// gate progress, matching how the single-screen version gated Submit.
export function isStepComplete(
  step: ServiceFormStep,
  answers: ServiceFieldAnswers,
): boolean {
  return step.fields
    .filter((field: ServiceField) => field.required)
    .every((field) => {
      const value = answers[field.name];
      return typeof value === 'string' && value.trim().length > 0;
    });
}
