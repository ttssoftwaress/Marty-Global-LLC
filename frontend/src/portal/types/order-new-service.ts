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
  | 'registered-agent'
  | 'virtual-mail-room'
  | 'remote-desktop'
  | 'website'
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
  /*
   * The same questions grouped into steps, when the admin has split them. A
   * service configured before steps existed carries only the flat
   * `detailFields`; `serviceFormSteps` resolves either shape to a step list, so
   * the order flow never branches on which one came back.
   */
  formSteps?: ServiceFormStep[];
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
 * generic form (AGENTS.md: the backend resolves amounts; we never collect card
 * data anywhere).
 * Step 2 is a quote request, so every field is descriptive.
 */
export type ServiceFieldType = 'text' | 'select' | 'textarea' | 'file';

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

/*
 * A dropdown choice, plus the parent answers it belongs to.
 *
 * `when` is what makes a dropdown conditional: a choice carrying `when: ['us']`
 * is offered only while the field's parent — the field named by `dependsOn` — is
 * answered `us`. A choice with no `when` is offered under every parent answer.
 */
export type ServiceSelectOption = {
  value: string;
  label: string;
  when?: string[];
};

export type ServiceSelectField = ServiceFieldBase & {
  type: 'select';
  options: ServiceSelectOption[];
  /*
   * The field whose answer filters these choices — "country" on a State
   * dropdown, "state" on the addresses beneath it. Chains to any depth, since
   * each level names only the one above it.
   *
   * Absent on an ordinary dropdown. When present the control offers NOTHING
   * until the parent is answered, which is what stops a state list appearing
   * before a country is chosen and an address from another state appearing at
   * all. The backend re-derives the same set when validating — the filtered
   * control is a courtesy, never the rule (AGENTS.md: guards are server-side).
   */
  dependsOn?: string;
};

export type ServiceTextareaField = ServiceFieldBase & {
  type: 'textarea';
  // Visible rows; defaults to a comfortable multi-line height when omitted.
  rows?: number;
};

/*
 * A document-upload question — an admin-authored file selector. The admin sets
 * which MIME types the picker offers, the per-file size cap, and whether one
 * question may collect several files; the customer gets a dropzone in place of
 * a text input.
 *
 * The answer is still a string on the wire, like every other field: the files
 * upload to R2 separately (AGENTS.md, Storage) and the answer records what was
 * attached. The selected `File` objects live in the draft's `filesByField` until
 * that upload step exists.
 */
export type ServiceFileField = ServiceFieldBase & {
  type: 'file';
  accept?: string[];
  maxSizeMb?: number;
  multiple?: boolean;
};

export type ServiceField =
  | ServiceTextField
  | ServiceSelectField
  | ServiceTextareaField
  | ServiceFileField;

/*
 * How a service's questions are split into steps — the customer-facing half of
 * the admin's "Request form & steps" control.
 *
 * A step is a titled group of fields; Step 2 renders one screen per step and
 * gates Continue on that step's required fields. Because the grouping is data,
 * an admin adding a step changes this flow with no deploy in either app.
 *
 * `key` identifies the step; `title` and `description` are what the screen
 * prints above its fields. Mirrors the admin's `ServiceFormStep` exactly
 * (AGENTS.md, two-apps sync rule).
 */
export type ServiceFormStep = {
  key: string;
  title: string;
  description?: string;
  fields: ServiceField[];
};

/*
 * The Step 2 draft the screen collects before submission.
 *
 * Answers are keyed by FIELD NAME, not by service — this is the master form. A
 * customer ordering three services fills in one merged questionnaire, so a
 * question two of those services both ask ("company_name") is asked once and
 * held once. `answersByService`, which is what the backend receives, is derived
 * from this at submit by fanning each answer back out to every service that
 * asked for it.
 *
 * `filesByField` holds the `File` objects a document-upload question collected,
 * under the same field key. Files upload separately to R2 (AGENTS.md, Storage);
 * until that step exists the draft only tracks the selection.
 *
 * `documents` and `notes` stay application-wide — the design puts one documents
 * card and one notes card below the questions, and neither belongs to a service.
 */
export type ServiceFieldAnswers = Record<string, string>;

export type OrderApplicationDraft = {
  answers: ServiceFieldAnswers;
  filesByField: Record<string, File[]>;
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
