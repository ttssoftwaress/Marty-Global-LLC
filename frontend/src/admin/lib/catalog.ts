import { format, parseISO } from 'date-fns';

import type {
  CatalogServiceDetail,
  FeatureDraft,
  Money,
  PricingTierDraft,
  ServiceDetailDraft,
  ServiceDetailWritePayload,
  ServiceFieldRef,
  ServiceFieldDraft,
  ServiceFormDraft,
  ServiceFormErrors,
  ServiceFormStep,
  ServiceFormStepDraft,
  ServiceRegion,
  ServiceRegionSetting,
  ServiceWritePayload,
} from '../types/catalog';
import { EMPTY_SERVICE_FORM } from '../types/catalog';

/*
 * Catalog form plumbing: the draft the modal edits, the payload it submits, and
 * the money conversion between them.
 *
 * The one rule this file exists to enforce is AGENTS.md's money rule. A form
 * necessarily collects a price as typed text ("199.00"), and the wire carries
 * integer minor units (`19900`). `toMinorUnits` is the single place that
 * conversion happens, and it does it by parsing the digits either side of the
 * decimal point rather than multiplying a float — `Math.round(199.99 * 100)`
 * is the exact class of arithmetic the money rules forbid.
 */

const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  USDT: 6,
};

export function minorUnitExponent(currency: string) {
  return MINOR_UNIT_EXPONENT[currency] ?? 2;
}

export const CATALOG_CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD'];

/*
 * "199.5" + USD → 19950. Returns null when the text isn't a well-formed amount,
 * which is what the form reports as a field error.
 *
 * Digits are read as strings and the fraction is padded/truncated to the
 * currency's exponent, so the result is exact for any input the user can type —
 * no float ever participates.
 */
export function toMinorUnits(input: string, currency: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const exponent = minorUnitExponent(currency);
  const [whole, fraction = ''] = trimmed.split('.');

  // More decimals than the currency has is a mistake, not something to round
  // away silently — a price the admin typed must be the price we store.
  if (fraction.length > exponent) return null;

  const padded = fraction.padEnd(exponent, '0');
  const digits = `${whole}${padded}`.replace(/^0+(?=\d)/, '');

  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

// The inverse, for seeding the form from a saved tier: 19950 → "199.50".
export function toMajorUnits({ amount, currency }: Money): string {
  const exponent = minorUnitExponent(currency);
  if (exponent === 0) return String(amount);

  const digits = String(Math.abs(amount)).padStart(exponent + 1, '0');
  const whole = digits.slice(0, -exponent);
  const fraction = digits.slice(-exponent);

  return `${amount < 0 ? '-' : ''}${whole}.${fraction}`;
}

export function formatTierPrice({ amount, currency }: Money) {
  const exponent = minorUnitExponent(currency);

  if (currency === 'USDT') {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: exponent,
    }).format(amount / 10 ** exponent)} USDT`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amount / 10 ** exponent);
}

/*
 * "Jul 8, 2026". Timestamps arrive as UTC (AGENTS.md, Dates); `parseISO`
 * converts to the viewer's zone, which is the only place that happens.
 */
export function formatCatalogDate(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

// The design's tier column reads "4 pricing tiers" / "1 pricing tier".
export function formatTierCount(count: number) {
  return `${count} pricing tier${count === 1 ? '' : 's'}`;
}

/*
 * React keys for draft rows. A draft tier or field has no server id until it is
 * saved, and index keys break as soon as a row is removed from the middle, so
 * each row carries a local key minted here. A module counter (not `Math.random`
 * or a timestamp) keeps it deterministic and collision-free within a session.
 */
let draftKeySeq = 0;
export function nextDraftKey(prefix: string) {
  draftKeySeq += 1;
  return `${prefix}-${draftKeySeq}`;
}

export function emptyTierDraft(currency = 'USD'): PricingTierDraft {
  return {
    key: nextDraftKey('tier'),
    name: '',
    amount: '',
    currency,
    regionCode: '',
    turnaround: '',
  };
}

// A newly picked question. `fieldKey` is filled in by the picker; a draft row
// never exists without one, so this is only ever called with a chosen field.
export function fieldDraft(fieldKey: string, required = false): ServiceFieldDraft {
  return { key: nextDraftKey('field'), fieldKey, required };
}

/*
 * A picked question plus any parent dropdowns the form doesn't ask yet, in
 * chain order.
 *
 * A dependent dropdown offers nothing until its parent is answered, so picking
 * "Address" on a form with no "State" adds a control the customer can never
 * open — and the backend refuses to store it. Rather than let the admin discover
 * that on save, the missing ancestors come along with it, above it, which is the
 * only order they can be answered in.
 *
 * `asked` is every key the SERVICE already asks, not just this list's — the
 * parent may already sit on an earlier step, and adding it twice would break the
 * one-question-per-service rule.
 */
export function pickedFieldChain(
  fieldKey: string,
  registry: { key: string; config: { dependsOn?: string } }[],
  asked: readonly string[],
): ServiceFieldDraft[] {
  const byKey = new Map(registry.map((definition) => [definition.key, definition]));
  const present = new Set(asked);
  const chain: string[] = [];

  let cursor: string | undefined = fieldKey;
  // Bounded by the registry size: a stored cycle would otherwise spin here, and
  // the backend's depth cap is the real limit.
  for (let depth = 0; cursor && depth <= registry.length; depth += 1) {
    if (present.has(cursor)) break;
    present.add(cursor);
    chain.unshift(cursor);
    cursor = byKey.get(cursor)?.config.dependsOn;
  }

  return chain.map((key) => fieldDraft(key));
}

/*
 * Per-key messages for dependent dropdowns this form arranges wrongly — a chain
 * whose parent is missing, or sits below the field that needs it.
 *
 * The backend refuses both on save (`assertDependenciesSatisfied`), and this is
 * the same rule read out beside the row that breaks it. Reordering is a keyboard
 * action here, so "move Country above State" has to be visible next to the
 * arrows rather than arriving as an error at the bottom of a long form.
 *
 * `orderedKeys` is the form in reading order — for a stepped form, every step's
 * fields flattened in step order, since that is the sequence the customer meets
 * them in.
 */
export function dependencyIssues(
  orderedKeys: readonly string[],
  registry: { key: string; label: string; config: { dependsOn?: string } }[],
): Record<string, string> {
  const byKey = new Map(registry.map((definition) => [definition.key, definition]));
  const asked = new Set(orderedKeys);
  const issues: Record<string, string> = {};
  const seen = new Set<string>();

  for (const key of orderedKeys) {
    const parentKey = byKey.get(key)?.config.dependsOn;

    if (parentKey && !seen.has(parentKey)) {
      const parentLabel = byKey.get(parentKey)?.label ?? parentKey;
      issues[key] = asked.has(parentKey)
        ? `Move ${parentLabel} above this — its answer decides what this offers.`
        : `Add ${parentLabel} first — this offers nothing until it is answered.`;
    }

    seen.add(key);
  }

  return issues;
}

// Text areas that collect a list edit as one item per line.
function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitChips(value: string) {
  return value
    .split(',')
    .map((chip) => chip.trim())
    .filter(Boolean);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/*
 * Seed the form from a saved service. Prices come back to major units for the
 * inputs, and the arrays the portal reads become the line-separated text the
 * admin edits.
 */
export function draftFromService(
  service: CatalogServiceDetail,
): ServiceFormDraft {
  return {
    iconKey: service.iconKey,
    name: service.name,
    shortName: service.shortName ?? '',
    description: service.description,
    features: service.features.join('\n'),
    footerLabel: service.footer?.label ?? '',
    footerChips: (service.footer?.chips ?? []).join(', '),
    regionCodes: [...service.regionCodes],
    pricingTiers: service.pricingTiers.map((tier) => ({
      key: nextDraftKey('tier'),
      id: tier.id,
      name: tier.name,
      amount: toMajorUnits(tier.price),
      currency: tier.price.currency,
      regionCode: tier.regionCode ?? '',
      turnaround: tier.turnaround ?? '',
    })),
    detailFields: service.detailFields.map(fieldDraftFromRef),
    active: service.active,
  };
}

export function newServiceDraft(): ServiceFormDraft {
  return { ...EMPTY_SERVICE_FORM, regionCodes: [], pricingTiers: [], detailFields: [] };
}

/*
 * Client-side validation. The backend's Zod schema is the real contract
 * (AGENTS.md — validation is server-side and authoritative); this only spares
 * the admin a round trip and points at the control that needs attention.
 */
export function validateServiceDraft(
  draft: ServiceFormDraft,
): ServiceFormErrors {
  const errors: ServiceFormErrors = {};

  if (!draft.name.trim()) errors.name = 'Service name is required.';
  if (!draft.description.trim())
    errors.description = 'Describe what this service covers.';
  if (draft.regionCodes.length === 0)
    errors.regionCodes = 'Select at least one region.';

  draft.pricingTiers.forEach((tier, index) => {
    if (!tier.name.trim()) errors[`tiers.${index}.name`] = 'Name this tier.';

    if (!tier.amount.trim()) {
      errors[`tiers.${index}.amount`] = 'Enter a price.';
    } else if (toMinorUnits(tier.amount, tier.currency) === null) {
      const exponent = minorUnitExponent(tier.currency);
      errors[`tiers.${index}.amount`] =
        exponent === 0
          ? 'Enter a whole number.'
          : `Enter an amount with up to ${exponent} decimal places.`;
    }
  });

  // A question is picked from the registry, so there is nothing to validate
  // about its shape — only that the service doesn't ask the same one twice.
  const picked = new Set<string>();
  draft.detailFields.forEach((field, index) => {
    if (picked.has(field.fieldKey)) {
      errors[`fields.${index}.fieldKey`] = 'This service already asks this question.';
    }
    picked.add(field.fieldKey);
  });

  return errors;
}

/*
 * Draft → wire payload. Called only after `validateServiceDraft` passes, so
 * every `toMinorUnits` here resolves; the `?? 0` fallbacks are unreachable and
 * exist to keep the return type non-nullable.
 */
export function payloadFromDraft(
  draft: ServiceFormDraft,
): ServiceWritePayload {
  const chips = splitChips(draft.footerChips);

  return {
    iconKey: draft.iconKey,
    name: draft.name.trim(),
    shortName: draft.shortName.trim() || undefined,
    description: draft.description.trim(),
    features: splitLines(draft.features),
    footer: {
      label: draft.footerLabel.trim(),
      ...(chips.length > 0 ? { chips } : {}),
    },
    detailFields: draft.detailFields.map(toFieldRef),
    regionCodes: [...draft.regionCodes],
    pricingTiers: draft.pricingTiers.map((tier) => ({
      ...(tier.id ? { id: tier.id } : {}),
      name: tier.name.trim(),
      price: {
        amount: toMinorUnits(tier.amount, tier.currency) ?? 0,
        currency: tier.currency,
      },
      regionCode: tier.regionCode || null,
      ...(tier.turnaround.trim() ? { turnaround: tier.turnaround.trim() } : {}),
    })),
    active: draft.active,
  };
}

/* ------------------------------------------------------------------ *
 * Request-form steps — the detail page's builder
 * ------------------------------------------------------------------ */

export function emptyStepDraft(): ServiceFormStepDraft {
  return {
    key: nextDraftKey('step'),
    title: '',
    description: '',
    fields: [],
  };
}

export function emptyFeatureDraft(value = ''): FeatureDraft {
  return { key: nextDraftKey('feature'), value };
}

/*
 * The one place the "stepped or flat" difference is resolved.
 *
 * A service authored before steps existed has only `detailFields`; one authored
 * since has `formSteps`. Both apps read the schema through this function, so
 * neither has to branch — a flat service simply reads as a single unnamed step
 * holding every field, which is exactly how it should render.
 */
export function stepsFromService(service: {
  formSteps?: ServiceFormStep[];
  detailFields?: ServiceFieldRef[];
}): ServiceFormStep[] {
  const steps = service.formSteps ?? [];
  if (steps.length > 0) return steps;

  const fields = service.detailFields ?? [];
  if (fields.length === 0) return [];

  return [{ key: 'details', title: 'Application details', fields }];
}

/*
 * Seed the detail page's draft from a saved service.
 *
 * Regions are the full region set, not just the ones the service covers: the
 * design's card lists every jurisdiction with a toggle, so a region the service
 * doesn't offer still needs a row to be switched on. Whatever the service has
 * saved wins; the rest default to off.
 */
export function detailDraftFromService(
  service: CatalogServiceDetail,
  allRegions: ServiceRegion[],
): ServiceDetailDraft {
  const enabled = new Set(service.regionCodes);
  const savedTurnaround = new Map(
    service.pricingTiers
      .filter((tier) => tier.regionCode && tier.turnaround)
      .map((tier) => [tier.regionCode as string, tier.turnaround as string]),
  );

  return {
    description: service.description,
    features: service.features.map((value) => emptyFeatureDraft(value)),
    regions: allRegions.map((region) => ({
      code: region.code,
      enabled: enabled.has(region.code),
      // The processing estimate the region row prints is the same figure the
      // region's pricing tier quotes, so it seeds from there rather than
      // inventing a second source of truth for the same number.
      processingTime: savedTurnaround.get(region.code) ?? '',
    })),
    pricingTiers: service.pricingTiers.map((tier) => ({
      key: nextDraftKey('tier'),
      id: tier.id,
      name: tier.name,
      amount: toMajorUnits(tier.price),
      currency: tier.price.currency,
      regionCode: tier.regionCode ?? '',
      turnaround: tier.turnaround ?? '',
      description: tier.description ?? '',
    })),
    steps: stepsFromService(service).map((step) => ({
      key: nextDraftKey('step'),
      savedKey: step.key,
      title: step.title,
      description: step.description ?? '',
      fields: step.fields.map(fieldDraftFromRef),
    })),
    active: service.active,
  };
}

// A stored reference → the builder's draft row. Nothing about the question's
// appearance is copied here: the builder reads that live from the registry.
function fieldDraftFromRef(ref: ServiceFieldRef): ServiceFieldDraft {
  return {
    key: nextDraftKey('field'),
    fieldKey: ref.fieldKey,
    required: Boolean(ref.required),
  };
}

/*
 * Client-side validation for the detail page. Same posture as the modal's: the
 * backend's Zod schema is the real contract, this only spares a round trip.
 *
 * Field keys must be unique across the whole service, not merely within a step —
 * answers are stored in one flat map per service, so two steps sharing a key
 * would overwrite each other.
 */
export function validateDetailDraft(
  draft: ServiceDetailDraft,
): ServiceFormErrors {
  const errors: ServiceFormErrors = {};

  if (!draft.description.trim())
    errors.description = 'Describe what this service covers.';

  draft.features.forEach((feature, index) => {
    if (!feature.value.trim())
      errors[`features.${index}`] = 'Enter an item or remove this row.';
  });

  if (!draft.regions.some((region) => region.enabled))
    errors.regions = 'Enable at least one region.';

  draft.pricingTiers.forEach((tier, index) => {
    if (!tier.name.trim()) errors[`tiers.${index}.name`] = 'Name this tier.';

    if (!tier.amount.trim()) {
      errors[`tiers.${index}.amount`] = 'Enter a price.';
    } else if (toMinorUnits(tier.amount, tier.currency) === null) {
      const exponent = minorUnitExponent(tier.currency);
      errors[`tiers.${index}.amount`] =
        exponent === 0
          ? 'Enter a whole number.'
          : `Enter an amount with up to ${exponent} decimal places.`;
    }
  });

  /*
   * A question is picked from the registry, so its shape needs no validating
   * here — only that the service doesn't ask the same one twice. Answers land in
   * one flat map per service, so the boundary is the service, not the step: the
   * same field on two steps would collide exactly as two picks on one step would.
   */
  const picked = new Set<string>();
  draft.steps.forEach((step, stepIndex) => {
    if (!step.title.trim())
      errors[`steps.${stepIndex}.title`] = 'Name this step.';

    step.fields.forEach((field, fieldIndex) => {
      if (picked.has(field.fieldKey)) {
        errors[`steps.${stepIndex}.fields.${fieldIndex}.fieldKey`] =
          'This question is already asked on another step.';
      }
      picked.add(field.fieldKey);
    });
  });

  return errors;
}

/*
 * Detail draft → wire payload. Called only after `validateDetailDraft` passes.
 *
 * Steps carry their fields, and the flattened union of those fields is sent as
 * `detailFields` too, so the flat readers stay correct without a second edit
 * surface (see `ServiceDetailWritePayload`).
 */
export function detailPayloadFromDraft(
  draft: ServiceDetailDraft,
): ServiceDetailWritePayload {
  const steps: ServiceFormStep[] = draft.steps.map((step) => ({
    key: step.savedKey || slugify(step.title) || nextDraftKey('step'),
    title: step.title.trim(),
    ...(step.description.trim() ? { description: step.description.trim() } : {}),
    fields: step.fields.map(toFieldRef),
  }));

  return {
    description: draft.description.trim(),
    features: draft.features
      .map((feature) => feature.value.trim())
      .filter(Boolean),
    regions: draft.regions.map<ServiceRegionSetting>((region) => ({
      code: region.code,
      enabled: region.enabled,
      processingTime: region.processingTime.trim(),
    })),
    pricingTiers: draft.pricingTiers.map((tier) => ({
      ...(tier.id ? { id: tier.id } : {}),
      name: tier.name.trim(),
      price: {
        amount: toMinorUnits(tier.amount, tier.currency) ?? 0,
        currency: tier.currency,
      },
      regionCode: tier.regionCode || null,
      ...(tier.turnaround.trim() ? { turnaround: tier.turnaround.trim() } : {}),
      ...(tier.description?.trim()
        ? { description: tier.description.trim() }
        : {}),
    })),
    formSteps: steps,
    detailFields: steps.flatMap((step) => step.fields),
    active: draft.active,
  };
}

// Moving a row within a list — the grip handle's keyboard controls and the
// step reorder buttons both resolve to this.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  if (from < 0 || from >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1) as [T];
  next.splice(to, 0, moved);
  return next;
}

/*
 * A draft row → the stored reference. Only which question and whether this
 * service requires it — everything else about the field lives in the registry,
 * so a service can never carry a stale copy of a label or a choice list.
 */
function toFieldRef(field: ServiceFieldDraft): ServiceFieldRef {
  return {
    fieldKey: field.fieldKey,
    ...(field.required ? { required: true } : {}),
  };
}
