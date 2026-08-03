/*
 * The field registry — local mirror of the API shapes the "Form fields" screen
 * renders and its form submits (AGENTS.md, two-apps sync rule; the backend owns
 * the registry).
 *
 * The registry is the vocabulary every service form is built from. An admin
 * registers a question once — "Company name", "Passport upload" — and then
 * builds a service's form by PICKING from this list rather than re-authoring the
 * question each time.
 *
 * Two consequences worth stating, because they are the reason the registry
 * exists:
 *
 *   - Answer keys are a closed set. Every key in an order's stored answers is a
 *     registered `key`, so the database never accumulates near-duplicates like
 *     `companyName` / `company_name` / `entityName` for one question.
 *   - The customer's merged master form is exact. Two services picking the same
 *     field are asking the same question by construction, so the order flow asks
 *     it once instead of guessing from a spelling match.
 */

export const FIELD_TYPES = ['text', 'select', 'textarea', 'file'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Short text', hint: 'A single-line answer.' },
  { value: 'select', label: 'Dropdown', hint: 'One choice from a fixed list.' },
  { value: 'textarea', label: 'Long text', hint: 'A multi-line answer.' },
  { value: 'file', label: 'Document upload', hint: 'One or more files.' },
];

export function fieldTypeLabel(type: string): string {
  return FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

/*
 * A dropdown choice, plus the parent answers it belongs to.
 *
 * `when` is what makes a dependent dropdown work: a choice carrying
 * `when: ['us']` is offered only while the field's parent — the field named by
 * `config.dependsOn` — is answered `us`. A choice with no `when` shows under
 * every parent value, which is how an "Other" escape hatch is written.
 */
export type SelectOption = { value: string; label: string; when?: string[] };

/*
 * The per-type extras. One flat shape covers all four types; the backend strips
 * the keys that don't apply to a field's own type on write, so a text field can
 * never carry a stray `maxSizeMb` a later reader might act on.
 */
export type FieldConfig = {
  options?: SelectOption[];
  // The dropdown whose answer filters this one's choices. Set only on a select.
  dependsOn?: string;
  rows?: number;
  accept?: string[];
  maxSizeMb?: number;
  multiple?: boolean;
};

/*
 * One registered field. `key` is the identifier answers are stored under and is
 * immutable once created — renaming it would orphan every answer already
 * recorded against it, so the edit form shows it read-only.
 *
 * `usageCount` is how many catalog services currently ask this question. It is
 * what makes the screen honest about the blast radius of an edit, and why a
 * field in use can no longer change its type.
 */
export type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  category?: string;
  config: FieldConfig;
  archived: boolean;
  sortOrder: number;
  updatedAt: string;
  usageCount: number;
  /*
   * Whether Delete is available on this row at all. The backend turns it off the
   * moment a service form or a request form references the key, and refuses the
   * call outright if a stored answer turns up — a field customers have already
   * answered is archived, never deleted.
   */
  canDelete: boolean;
  /*
   * The keys of the dropdowns filtered by this field's answer. Empty on almost
   * every field; on a "Country" it names its "State". The screen prints it so an
   * admin can see the chain before editing a link in it — and it is why a parent
   * can be neither deleted nor retyped while a child reads it.
   */
  dependentKeys: string[];
};

export type FieldDefinitionPage = {
  fields: FieldDefinition[];
  nextCursor: string | null;
  totalResults: number;
};

/*
 * What a document-upload field may accept. The admin picks from this list rather
 * than typing MIME types, so the stored value is always one the browser picker
 * and the server-side upload check both understand.
 */
export const FILE_ACCEPT_OPTIONS: { value: string; label: string }[] = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/png', label: 'PNG' },
  {
    value:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'DOCX',
  },
];

/*
 * The registry form's working draft. It differs from `FieldDefinition` in that a
 * form edits strings: dropdown choices are one-per-line text and the size cap is
 * typed text, both converted once at submit.
 */
export type FieldDraft = {
  key: string;
  label: string;
  type: FieldType;
  placeholder: string;
  hint: string;
  category: string;
  /*
   * Dropdown choices as one-per-line text. "value|Label" sets a stored value.
   *
   * A dependent dropdown's choices are grouped by parent answer with a
   * `[parentValue]` header line, and every choice below a header belongs to it:
   *
   *   [us]
   *   tx|Texas
   *   ca|California
   *
   *   [gb]
   *   eng|England
   *
   * Choices written before any header belong to no group and show under every
   * parent answer. A textarea rather than a control per parent value because the
   * parent may offer two hundred of them.
   */
  options: string;
  // The parent field's key, or '' for an independent dropdown.
  dependsOn: string;
  accept: string[];
  maxSizeMb: string;
  multiple: boolean;
  archived: boolean;
};

export const EMPTY_FIELD_DRAFT: FieldDraft = {
  key: '',
  label: '',
  type: 'text',
  placeholder: '',
  hint: '',
  category: '',
  options: '',
  dependsOn: '',
  accept: [],
  maxSizeMb: '',
  multiple: false,
  archived: false,
};

// The create payload. `key` is present only here — an update can never send one.
export type FieldCreatePayload = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  category?: string;
  config?: FieldConfig;
};

export type FieldUpdatePayload = {
  label?: string;
  type?: FieldType;
  placeholder?: string;
  hint?: string;
  category?: string;
  config?: FieldConfig;
  archived?: boolean;
};

// Field-level messages, keyed by the control that failed.
export type FieldFormErrors = Record<string, string>;
