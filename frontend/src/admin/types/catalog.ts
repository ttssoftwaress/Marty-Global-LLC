/*
 * Admin service catalog & pricing — local mirror of the API shapes the screen
 * renders and the form submits. The backend owns the catalog (AGENTS.md,
 * two-apps sync rule); these types exist so the UI composes before the admin
 * catalog endpoints land.
 *
 * The customer portal already reads this catalog through its own mirror
 * (`portal/types/order-new-service.ts`): `iconKey`, `name`, `shortName`,
 * `description`, `features`, `footer`, and `detailFields` are the same fields
 * the Step 1 / Step 2 order flow renders. The two areas never import from each
 * other (AGENTS.md, route-group rule), so this file re-declares them — the admin
 * form is the write side of exactly what the portal reads.
 *
 * What this screen adds on top of the portal's read shape is what the design's
 * table columns show: `regions` (where a service is offered) and `pricingTiers`
 * (how it's priced). Money is an integer minor-unit amount plus its ISO 4217
 * code everywhere (AGENTS.md, Money rules) — the UI never does arithmetic on it,
 * only formats at render, and a tier's price is captured in major units in the
 * form then converted once, at submit.
 */

import type { Money } from './dashboard';
import type { ResultFieldRef, ServiceRequestTypeDraft } from './delivery';

export type { Money };

/*
 * Which glyph a service shows. A string key resolved to a lucide icon in the UI,
 * mirroring the portal's `ServiceIconKey` — the catalog names an intent, the
 * frontend owns the actual glyph, so a key this build doesn't recognise still
 * renders a neutral default rather than breaking the row.
 */
export type ServiceIconKey =
  | 'company-formation'
  | 'virtual-mail-room'
  | 'bank-account'
  | 'e-commerce'
  | 'default';

export const SERVICE_ICON_OPTIONS: { value: ServiceIconKey; label: string }[] = [
  { value: 'company-formation', label: 'Company formation' },
  { value: 'virtual-mail-room', label: 'Virtual mail room' },
  { value: 'bank-account', label: 'Bank account' },
  { value: 'e-commerce', label: 'E-commerce' },
  { value: 'default', label: 'General service' },
];

/*
 * A region a service is offered in. The backend supplies the whole set the admin
 * may choose from (`GET /v1/admin/catalog/regions`) rather than the frontend
 * hardcoding a country list — adding a jurisdiction is then a data change, not a
 * deploy.
 *
 * `code` is the stable identifier stored on the service ("US", "GB"); `label` is
 * what the chip prints ("USA", "UK"); `flag` is the emoji the design shows
 * beside it. The flag is text from the API, not an exported asset — Design.md
 * forbids pulling image assets for glyphs, and an emoji needs no icon library.
 */
export type ServiceRegion = {
  code: string;
  label: string;
  flag: string;
};

/*
 * One pricing tier on a service — the unit the "4 pricing tiers" column counts.
 * A tier is a named price point ("Standard", "Expedited"), optionally scoped to
 * one region so a service can price the same tier differently per jurisdiction;
 * `regionCode` is null for a tier that applies everywhere the service is offered.
 *
 * `price` is integer minor units + ISO code — never a float (AGENTS.md, Money
 * rules). `turnaround` is the backend's phrasing for the delivery estimate
 * ("5–7 business days"), kept as free text because it varies per jurisdiction.
 */
export type ServicePricingTier = {
  id: string;
  name: string;
  price: Money;
  regionCode: string | null;
  turnaround?: string;
  description?: string;
};

/*
 * The card footer meta line the portal's Step 1 card renders — a label plus an
 * optional row of chips. Mirrors the portal's `ServiceFooter`; the admin edits
 * it here, the customer sees it there.
 */
export type ServiceFooter = {
  label: string;
  chips?: string[];
};

/*
 * A service's form is stored as REFERENCES into the field registry, never as
 * inline field definitions.
 *
 * What a question IS — its key, label, control type, choices, upload settings —
 * is owned by `FieldDefinition` and authored on the Form fields screen
 * (`admin/types/fields.ts`). A service records only which registered questions
 * it asks and whether each is mandatory *on this service*, which is the one
 * per-service difference that genuinely varies: a passport upload can be
 * optional for a company formation and required for a bank account.
 *
 * That split is what keeps the answer keys a closed set — every stored key is a
 * registered `fieldKey` — and what makes the customer's merged master form
 * exact: two services picking the same definition are asking the same question
 * by construction, so the order flow asks it once.
 *
 * No field type captures money or card data: amounts are resolved by the backend
 * and we never collect card data anywhere (AGENTS.md), so an admin-defined form
 * never carries either.
 */
export type ServiceFieldRef = {
  fieldKey: string;
  required?: boolean;
};

/*
 * How a service's questions are split into wizard steps — the admin control over
 * "how many steps are there in a service request for this service".
 *
 * A step is a titled group of fields. The portal renders one screen per step and
 * gates Continue on that step's required fields, so an admin adding a step
 * changes the customer's flow without a deploy in either app.
 *
 * `key` is the stable identifier an in-progress draft is keyed by; it must not
 * change once orders reference it, so the UI derives it from the title only
 * while the step is new.
 *
 * `fields` holds REFERENCES into the field registry, not definitions — a step
 * says which registered questions it asks, in what order.
 *
 * A service with no steps is the flat case the catalog already supported: every
 * field renders in one section. `stepsFromService` collapses the two into a
 * single shape so neither app branches on "stepped or not".
 */
export type ServiceFormStep = {
  key: string;
  title: string;
  description?: string;
  fields: ServiceFieldRef[];
};

/*
 * One row of the catalog. `regions` and `tierCount` are what the table's middle
 * columns print; the full `pricingTiers` array only loads with the detail the
 * form edits, so the list stays cheap.
 *
 * `updatedAt` is an ISO-8601 UTC timestamp (AGENTS.md, Dates), formatted into
 * the viewer's zone at render — the "Last updated" column and mobile's meta line
 * are the same value shown two ways.
 */
export type CatalogServiceRow = {
  id: string;
  name: string;
  regions: ServiceRegion[];
  tierCount: number;
  updatedAt: string;
  active: boolean;
};

/*
 * One page of the catalog. Cursor pagination is the API convention (AGENTS.md),
 * so the list can grow past the four rows the design happens to draw.
 */
export type CatalogServicePage = {
  rows: CatalogServiceRow[];
  nextCursor: string | null;
  totalResults: number;
};

/*
 * A service in full — what `GET /v1/admin/catalog/services/:id` returns and what
 * the Manage form loads into its draft. This is the row plus everything the
 * portal reads and the admin edits.
 */
export type CatalogServiceDetail = {
  id: string;
  iconKey: ServiceIconKey;
  name: string;
  shortName?: string;
  description: string;
  features: string[];
  footer: ServiceFooter;
  detailFields: ServiceFieldRef[];
  /*
   * The request form split into steps. Optional because a service whose form is
   * still flat carries only `detailFields`; the UI reads it through
   * `stepsFromService`, which falls back to a single step wrapping
   * `detailFields` so both shapes render identically.
   */
  formSteps?: ServiceFormStep[];
  regionCodes: string[];
  pricingTiers: ServicePricingTier[];
  /*
   * The delivery half — what this service RETURNS, and the follow-up actions it
   * offers. Edited on their own cards and saved through their own endpoints,
   * because they are a different decision from what the service sells: what it
   * delivers is settled once the team knows what the filing actually produces.
   *
   * An empty `resultFields` means the service delivers no structured record, so
   * it gets no customer page at all — which is why a service with nothing to
   * return is never a dead link in the portal sidebar.
   */
  resultFields: ResultFieldRef[];
  resultPageTitle?: string;
  resultNoun?: string;
  // Inactive types are included so the editor can show and re-enable them; the
  // customer's page only ever sees the active ones.
  requestTypes: ServiceRequestTypeDraft[];
  active: boolean;
  sortOrder: number;
  updatedAt: string;
};

/*
 * A region's per-service settings, as the "Supported regions" card edits them:
 * whether the service is offered there and the processing estimate shown beside
 * it. The design's toggle writes `enabled`; the sub-line prints `processingTime`.
 */
export type ServiceRegionSetting = {
  code: string;
  enabled: boolean;
  processingTime: string;
};

/*
 * The form's working draft. It differs from `CatalogServiceDetail` in two ways,
 * both because a form edits strings:
 *
 *   - a tier's price is a major-unit string ("199.00") while the admin types it,
 *     converted to integer minor units exactly once at submit (`toMinorUnits`),
 *     so no float ever reaches the wire (AGENTS.md, Money rules);
 *   - a draft tier has no server id yet, so tiers carry a local `key` for React
 *     and an optional `id` for the ones that already exist.
 */
export type PricingTierDraft = {
  key: string;
  id?: string;
  name: string;
  amount: string; // major units as typed — never used for arithmetic
  currency: string;
  regionCode: string; // '' means "all regions the service covers"
  turnaround: string;
  // The "Includes / notes" column on the detail page's pricing table. Optional
  // because the list screen's modal doesn't edit it.
  description?: string;
};

/*
 * One picked question while the builder edits it.
 *
 * It is a reference, not a definition: `fieldKey` names the registered field and
 * `required` is this service's own flag. `key` is only a React key for the row,
 * since the same registry entry can be reordered but never appears twice on one
 * service.
 *
 * Everything else about the question — its label, control type, choices, upload
 * settings — is read live from the registry, so the builder shows the current
 * definition rather than a copy that could drift.
 */
export type ServiceFieldDraft = {
  key: string;
  fieldKey: string;
  required: boolean;
};

/*
 * One step while the builder edits it: a title, an optional description, and the
 * registered questions it asks in order.
 */
export type ServiceFormStepDraft = {
  key: string;
  // Empty until saved; a new step has no stable key to preserve yet.
  savedKey?: string;
  title: string;
  description: string;
  fields: ServiceFieldDraft[];
};

export type ServiceFormDraft = {
  iconKey: ServiceIconKey;
  name: string;
  shortName: string;
  description: string;
  // Feature bullets as one-per-line text while editing; split at submit.
  features: string;
  footerLabel: string;
  footerChips: string;
  regionCodes: string[];
  pricingTiers: PricingTierDraft[];
  detailFields: ServiceFieldDraft[];
  active: boolean;
};

/*
 * The detail page's working draft. The full-page editor (unlike the list's modal)
 * owns the four Figma cards plus the request-form builder, so it edits exactly
 * what those cards show and nothing else — name and icon stay with the create
 * form on the list screen.
 *
 * `features` is a row array here rather than the modal's line-separated textarea,
 * because the design's "What's included" card is a list of individual inputs that
 * reorder and remove one at a time.
 */
export type ServiceDetailDraft = {
  description: string;
  features: FeatureDraft[];
  regions: ServiceRegionSetting[];
  pricingTiers: PricingTierDraft[];
  steps: ServiceFormStepDraft[];
};

export type FeatureDraft = {
  key: string;
  value: string;
};

/*
 * The create/update payload. Resolved from the draft at submit — prices are
 * integer minor units by this point, and the line-separated text areas have
 * become arrays.
 */
export type ServiceWritePayload = {
  iconKey: ServiceIconKey;
  name: string;
  shortName?: string;
  description: string;
  features: string[];
  footer: ServiceFooter;
  detailFields: ServiceFieldRef[];
  regionCodes: string[];
  pricingTiers: {
    id?: string;
    name: string;
    price: Money;
    regionCode: string | null;
    turnaround?: string;
  }[];
  active: boolean;
};

/*
 * The detail page's PATCH payload — the four Figma cards plus the request-form
 * steps. It is deliberately narrower than `ServiceWritePayload`: this screen
 * never edits a service's name or icon, so it never sends them.
 *
 * `detailFields` is sent alongside `formSteps` as the flattened union of every
 * step's field references, so a consumer reading only the flat shape (any code
 * path that doesn't care about grouping) still sees every question.
 */
export type ServiceDetailWritePayload = {
  description: string;
  features: string[];
  regions: ServiceRegionSetting[];
  pricingTiers: {
    id?: string;
    name: string;
    price: Money;
    regionCode: string | null;
    turnaround?: string;
    description?: string;
  }[];
  formSteps: ServiceFormStep[];
  detailFields: ServiceFieldRef[];
};

// Field-level messages the form renders under the control that failed. Keyed by
// a path ('name', 'tiers.0.amount') so a nested row can flag its own input.
export type ServiceFormErrors = Record<string, string>;

export const EMPTY_SERVICE_FORM: ServiceFormDraft = {
  iconKey: 'default',
  name: '',
  shortName: '',
  description: '',
  features: '',
  footerLabel: '',
  footerChips: '',
  regionCodes: [],
  pricingTiers: [],
  detailFields: [],
  active: true,
};
