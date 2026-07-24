/*
 * Order a new service — local mirror of the service-catalog shapes the Step 1
 * screen renders. The backend owns the catalog (AGENTS.md, two-apps sync rule);
 * an admin adds, edits, or removes services, so this screen must render however
 * many come back — never a fixed set. These types exist so the UI composes
 * before the catalog endpoint lands.
 *
 * Pricing is deliberately absent: Step 1 is quote-based ("Pricing is shared
 * after review" in the design), so no money crosses the wire here. When a
 * priced catalog arrives it will carry integer minor units + ISO code
 * (AGENTS.md, Money rules) — never a float on this screen.
 */

// Which glyph a service card shows. A string key, resolved to a lucide icon in
// the UI (serviceIcons.ts) — the catalog names an intent, the frontend owns the
// actual icon so an unknown/new key still renders a sensible default.
export type ServiceIconKey =
  | 'company-formation'
  | 'virtual-mail-room'
  | 'bank-account'
  | 'e-commerce'
  | 'default';

/*
 * The card footer is one small uppercase meta line. Most services render it as
 * plain text ("COVERAGE — US, UK, EU, UAE"); the e-commerce card renders a
 * label plus a row of marketplace chips. Modelling both as an optional `chips`
 * array keeps a single card component covering every service the admin defines.
 */
export type ServiceFooter = {
  label: string;
  chips?: string[];
};

export type OrderableService = {
  id: string;
  iconKey: ServiceIconKey;
  name: string;
  // Short chip label for the selected-services rail / bottom bar, where the full
  // name may be too long ("Bank Account Opening" for "Bank Account Opening
  // Assistance"). Falls back to `name` when the backend omits it.
  shortName?: string;
  description: string;
  features: string[];
  footer: ServiceFooter;
  // Step 2 (Application details) renders one form section per selected service,
  // driven by this schema. It's admin-defined per service — Company Formation
  // asks four things, Bank Account Opening two — so the form is data, never a
  // fixed set of inputs. Optional because Step 1 doesn't need it; a service with
  // no fields simply contributes no inputs to the application.
  detailFields?: ServiceField[];
};

// The Step 1 payload: the catalog to choose from. The backend resolves the list
// (active services only, in display order); the screen renders it as-is.
export type OrderServiceCatalog = {
  services: OrderableService[];
};

/*
 * Application-detail field schema — the wire contract for Step 2's per-service
 * form. The backend defines each service's fields; the frontend renders them by
 * `type`, so a new field on any service needs no UI change. A discriminated
 * union keeps every field carrying exactly the props its control needs (options
 * for a select, rows for a textarea) and nothing it doesn't.
 *
 * No field type here captures money or a card number — those never live in a
 * generic form (AGENTS.md: the backend resolves amounts; Stripe holds the card).
 * Step 2 is a quote request, so every field is descriptive.
 */
export type ServiceFieldType = 'text' | 'select' | 'textarea';

type ServiceFieldBase = {
  // Stable key the answer is stored under, unique within a service's fields.
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  // Helper text under the control (e.g. a format hint). Rarely set.
  hint?: string;
};

export type ServiceTextField = ServiceFieldBase & {
  type: 'text';
};

export type ServiceSelectOption = {
  value: string;
  label: string;
};

export type ServiceSelectField = ServiceFieldBase & {
  type: 'select';
  options: ServiceSelectOption[];
};

export type ServiceTextareaField = ServiceFieldBase & {
  type: 'textarea';
  // Visible rows; defaults to a comfortable multi-line height when omitted.
  rows?: number;
};

export type ServiceField =
  | ServiceTextField
  | ServiceSelectField
  | ServiceTextareaField;

/*
 * The Step 2 draft the screen collects before submission. Answers are keyed by
 * service id, then by field name, so each service's section owns its own values
 * independently. Files and notes are application-wide (the design puts one
 * documents card and one notes card below the per-service sections), so they sit
 * at the top level rather than under a service.
 *
 * This is the client-side shape; the submit payload the backend receives is
 * resolved from it (files upload separately to R2 per AGENTS.md — the draft only
 * tracks the selected File objects until then).
 */
export type ServiceFieldAnswers = Record<string, string>;

export type OrderApplicationDraft = {
  answersByService: Record<string, ServiceFieldAnswers>;
  documents: File[];
  notes: string;
};

/*
 * Step 3 (Application submitted) — what the confirmation screen renders after a
 * successful submit. This is the shape the create-application endpoint returns
 * (AGENTS.md: the backend owns order references and timestamps); Step 2 carries
 * it here via router state, the same way Step 1 hands the selection to Step 2.
 * Nothing on the screen is hardcoded — the reference, date, services, and email
 * all come from this payload.
 *
 * `submittedAt` is an ISO UTC timestamp (AGENTS.md, Dates) formatted at render.
 * `serviceNames` are the display names of the ordered services, in the order
 * they were selected, so the body copy and the SERVICES row read consistently
 * for any number of services — not just the two in the design.
 */
export type OrderConfirmation = {
  reference: string;
  submittedAt: string;
  serviceNames: string[];
  confirmationEmail: string;
};
