import type {
  OrderableService,
  ServiceField,
  ServiceFieldAnswers,
  ServiceFormStep,
  ServiceSelectOption,
} from '../../types/order-new-service';

/*
 * Building the master application form from the selected services' own
 * admin-authored request forms.
 *
 * THE RULE THIS FILE EXISTS FOR: the customer never sees one form per service.
 * Ordering Company Formation + Bank Account Opening + Virtual Mail Room is one
 * questionnaire, not three, and a question all three ask — "what is the company
 * name?" — is asked exactly once.
 *
 * How the merge works:
 *
 *   - A field's `name` is the identity of the question. Two services asking
 *     `company_name` are asking the same thing, so they collapse into one input
 *     and one answer. This is why a key is unique only WITHIN a service and is
 *     deliberately shared BETWEEN them — it is the admin's vocabulary for "this
 *     is the same question".
 *   - Steps merge on their `key` for the same reason: two services that both
 *     define an `entity-details` step contribute their questions to one screen
 *     rather than two consecutive screens asking overlapping things.
 *   - When two services define the same question slightly differently, the first
 *     definition wins for presentation (label, placeholder, choices) but the
 *     merged field is required if ANY service requires it, and a select offers
 *     the union of the choices. Dropping an option would make one service's form
 *     unanswerable; ignoring its required flag would let an incomplete
 *     application through.
 *
 * `answersByService` — the payload the backend still expects, keyed by service
 * then field — is rebuilt from the merged answers at submit by
 * `answersByServiceFrom`, giving each service exactly the questions it asked.
 * So the merge is entirely a customer-facing concern: the order record, the
 * admin's view of it, and the per-service validation are all unchanged.
 */

// The step title a service's flat (unstepped) fields are grouped under. Services
// sharing this key merge into one screen, which is the desired reading: several
// flat services produce a single "Application details" screen, not one each.
const FLAT_STEP_KEY = 'details';
const FLAT_STEP_TITLE = 'Application details';

export function serviceFormSteps(service: OrderableService): ServiceFormStep[] {
  const steps = service.formSteps ?? [];
  if (steps.length > 0) return steps;

  const fields = service.detailFields ?? [];
  if (fields.length === 0) return [];

  return [{ key: FLAT_STEP_KEY, title: FLAT_STEP_TITLE, fields }];
}

/*
 * Every question a service asks, whichever shape it was authored in. Mirrors the
 * backend's `serviceQuestions`: the union of its steps and its flat list,
 * de-duplicated by name, so a service is never asked about twice or missed.
 */
export function serviceQuestions(service: OrderableService): ServiceField[] {
  const byName = new Map<string, ServiceField>();

  for (const field of serviceFormSteps(service).flatMap((step) => step.fields)) {
    if (!byName.has(field.name)) byName.set(field.name, field);
  }
  for (const field of service.detailFields ?? []) {
    if (!byName.has(field.name)) byName.set(field.name, field);
  }

  return [...byName.values()];
}

/*
 * One question on the master form: the merged field plus which services asked
 * it. `askedBy` is what the UI uses to tell the customer why a question is
 * there ("Company Formation · Bank Account Opening") and what routes the answer
 * back to the right services at submit.
 */
export type MasterField = {
  field: ServiceField;
  askedBy: OrderableService[];
};

/*
 * One screen of the master form: a merged step and its merged questions. Two
 * services contributing to the same step key produce one screen listing both
 * their services.
 */
export type ApplicationStep = {
  key: string;
  title: string;
  description?: string;
  fields: MasterField[];
  askedBy: OrderableService[];
};

/*
 * Merge two definitions of the same question.
 *
 * Presentation comes from the first service that asked (catalog order, so it is
 * stable and predictable). The two things that are unioned rather than
 * overwritten are the ones where taking only the first would break the other
 * service's form: `required` and a select's `options`.
 */
function mergeField(existing: ServiceField, incoming: ServiceField): ServiceField {
  const required = Boolean(existing.required || incoming.required);
  const merged: ServiceField = required
    ? { ...existing, required: true }
    : { ...existing };

  // Same key, different control type is an admin authoring mistake. The first
  // definition stands rather than guessing which is right — a merged field must
  // render as exactly one control, and silently switching type would discard
  // whatever the customer had already typed into it.
  if (merged.type !== incoming.type) return merged;

  if (merged.type === 'select' && incoming.type === 'select') {
    const seen = new Set(merged.options.map((option) => option.value));
    const extra = incoming.options.filter((option) => !seen.has(option.value));
    if (extra.length > 0) {
      return { ...merged, options: [...merged.options, ...extra] };
    }
  }

  if (merged.type === 'file' && incoming.type === 'file') {
    return {
      ...merged,
      // The stricter cap wins: a file one service would reject must not be
      // accepted just because another service is more permissive.
      ...(merged.maxSizeMb !== undefined && incoming.maxSizeMb !== undefined
        ? { maxSizeMb: Math.min(merged.maxSizeMb, incoming.maxSizeMb) }
        : {}),
      // Only offer a multi-file picker if every asking service can take a set.
      multiple: Boolean(merged.multiple && incoming.multiple),
    };
  }

  return merged;
}

/*
 * The master form: the selected services' steps merged into one flow.
 *
 * Services are walked in catalog order and their steps in the order the admin
 * arranged them, so the screens read in a sensible sequence and a step that
 * several services share appears at the position its first contributor put it.
 */
export function buildApplicationSteps(
  services: OrderableService[],
): ApplicationStep[] {
  const steps = new Map<
    string,
    {
      key: string;
      title: string;
      description?: string;
      fields: Map<string, MasterField>;
      askedBy: OrderableService[];
    }
  >();

  for (const service of services) {
    for (const step of serviceFormSteps(service)) {
      let entry = steps.get(step.key);

      if (!entry) {
        entry = {
          key: step.key,
          title: step.title,
          ...(step.description ? { description: step.description } : {}),
          fields: new Map(),
          askedBy: [],
        };
        steps.set(step.key, entry);
      }

      if (!entry.askedBy.includes(service)) entry.askedBy.push(service);

      for (const field of step.fields) {
        const existing = entry.fields.get(field.name);

        if (!existing) {
          entry.fields.set(field.name, { field, askedBy: [service] });
          continue;
        }

        // The same question again, from another service: merge the definition
        // and record the extra claimant so the answer reaches both.
        existing.field = mergeField(existing.field, field);
        if (!existing.askedBy.includes(service)) existing.askedBy.push(service);
      }
    }
  }

  return [...steps.values()]
    .map((entry) => ({
      key: entry.key,
      title: entry.title,
      ...(entry.description ? { description: entry.description } : {}),
      fields: [...entry.fields.values()],
      askedBy: entry.askedBy,
    }))
    // A step every one of whose questions was merged away cannot happen, but a
    // step an admin left empty can — and an empty screen is never worth showing.
    .filter((step) => step.fields.length > 0);
}

/*
 * The choices a dropdown currently offers.
 *
 * The cascade rule, and the mirror of the backend's own `visibleOptions`: with
 * its parent unanswered a dependent dropdown offers NOTHING — which is what
 * keeps a state list from showing before a country is picked — and once the
 * parent is answered it offers the choices scoped to that answer plus any choice
 * scoped to none.
 *
 * An ordinary dropdown returns its whole list, so callers never branch.
 */
export function visibleOptions(
  field: Extract<ServiceField, { type: 'select' }>,
  answers: ServiceFieldAnswers,
): ServiceSelectOption[] {
  if (!field.dependsOn) return field.options;

  const parentValue = (answers[field.dependsOn] ?? '').trim();
  if (!parentValue) return [];

  return field.options.filter(
    (option) => !option.when || option.when.includes(parentValue),
  );
}

/*
 * Every field downstream of one that just changed.
 *
 * Changing a country invalidates the state chosen under it, and the address
 * chosen under that — the answers are still non-empty and would still be
 * submitted, and the backend would reject the whole application for a
 * contradiction the customer can't see. So the answers go when the parent moves,
 * and the controls reset to their locked, empty state.
 *
 * Computed across the WHOLE master form rather than per step, because a chain is
 * routinely split across screens.
 */
export function descendantFieldNames(
  steps: ApplicationStep[],
  fieldName: string,
): string[] {
  const parents = new Map<string, string>();

  for (const step of steps) {
    for (const { field } of step.fields) {
      if (field.type === 'select' && field.dependsOn) {
        parents.set(field.name, field.dependsOn);
      }
    }
  }

  const found = new Set<string>();
  let frontier = new Set([fieldName]);

  // Level by level, bounded by the number of dependent fields — a cycle the
  // registry should never store cannot spin this.
  for (let depth = 0; frontier.size > 0 && depth <= parents.size; depth += 1) {
    const next = new Set<string>();

    for (const [child, parent] of parents) {
      if (frontier.has(parent) && !found.has(child) && child !== fieldName) {
        found.add(child);
        next.add(child);
      }
    }

    frontier = next;
  }

  return [...found];
}

// Every required field on a step has a non-empty answer. Optional fields never
// gate progress.
export function isStepComplete(
  step: ApplicationStep,
  answers: ServiceFieldAnswers,
): boolean {
  return step.fields
    .filter((entry) => entry.field.required)
    .every((entry) => {
      const value = answers[entry.field.name];
      return typeof value === 'string' && value.trim().length > 0;
    });
}

/*
 * Merged answers → the per-service payload the backend validates.
 *
 * Each service receives exactly the questions it asked, so a shared answer is
 * recorded against every service that wanted it. This is what lets the customer
 * answer once while each `OrderItem` still holds a complete, self-contained set
 * of answers — the admin reading one item sees every question that item's
 * service asked, not a cross-reference to another service's answers.
 */
export function answersByServiceFrom(
  services: OrderableService[],
  answers: ServiceFieldAnswers,
): Record<string, ServiceFieldAnswers> {
  const byService: Record<string, ServiceFieldAnswers> = {};

  for (const service of services) {
    const own: ServiceFieldAnswers = {};

    for (const field of serviceQuestions(service)) {
      const value = answers[field.name];
      if (typeof value === 'string' && value.trim().length > 0) {
        own[field.name] = value;
      }
    }

    byService[service.id] = own;
  }

  return byService;
}
