import type { AdminOrderItemStatus } from './order-detail';

/*
 * Service delivery, staff side — filling in what a customer receives, and
 * working the follow-up queue.
 *
 * A local mirror of the backend's wire contract (AGENTS.md, two-apps sync). The
 * source is `backend/src/modules/admin/delivery/` and the shared field shapes in
 * `modules/results/results.validation.ts`.
 *
 * The result field types are re-declared here rather than imported from the
 * portal's mirror: the two apps' areas never import from each other, and the
 * admin form needs the same shapes the customer's page renders.
 */

export type ResultFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'file'
  | 'date'
  | 'number'
  | 'url'
  | 'status';

export const RESULT_FIELD_TYPE_OPTIONS: {
  value: ResultFieldType;
  label: string;
  hint: string;
}[] = [
  { value: 'text', label: 'Short text', hint: 'A single-line fact.' },
  { value: 'textarea', label: 'Long text', hint: 'A multi-line note.' },
  { value: 'select', label: 'Dropdown', hint: 'One choice from a fixed list.' },
  { value: 'status', label: 'Status chip', hint: 'A coloured state chip.' },
  { value: 'date', label: 'Date', hint: 'Shown in the customer’s timezone.' },
  { value: 'number', label: 'Number', hint: 'Grouped, optionally prefixed.' },
  { value: 'url', label: 'Link', hint: 'An external page, e.g. a registry.' },
  { value: 'file', label: 'Document', hint: 'A file the customer downloads.' },
];

export function resultFieldTypeLabel(type: string): string {
  return (
    RESULT_FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
  );
}

// A status chip's meaning, not its colour — the admin picks the meaning and the
// frontend owns the hue (Design.md: no hardcoded hex).
export const STATUS_TONES = [
  'neutral',
  'success',
  'warning',
  'error',
  'info',
] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export type ResultSelectOption = { value: string; label: string };
export type ResultStatusOption = ResultSelectOption & { tone: StatusTone };

export type ResultFieldConfig = {
  options?: ResultSelectOption[];
  statusOptions?: ResultStatusOption[];
  rows?: number;
  accept?: string[];
  maxSizeMb?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  withTime?: boolean;
};

/*
 * One registered result field. `key` is the identifier delivered values are
 * stored under and is immutable once created — renaming it would orphan every
 * record already holding a value, so the edit form shows it read-only.
 *
 * `usageCount` is how many services return this fact. It is why a field in use
 * can no longer change its type: every value already delivered was validated
 * against the old control.
 *
 * `isPrimary` and `showInList` here are DEFAULTS a picking service inherits. The
 * service's own reference overrides them, because the same "Company name" titles
 * a formation record and is an ordinary column on an annual report.
 */
export type ResultFieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: ResultFieldType;
  hint?: string;
  category?: string;
  config: ResultFieldConfig;
  isPrimary: boolean;
  showInList: boolean;
  archived: boolean;
  sortOrder: number;
  updatedAt: string;
  usageCount: number;
  /*
   * Whether Delete is available on this row at all — false once a service
   * returns the fact or a delivered record holds a value for it, since a record
   * must keep rendering. Those are archived instead.
   */
  canDelete: boolean;
};

export type ResultFieldPage = {
  fields: ResultFieldDefinition[];
  nextCursor: string | null;
  totalResults: number;
};

// --- The resolved schema a form renders ----------------------------------

type ResolvedBase = {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  category?: string;
  isPrimary?: boolean;
  showInList?: boolean;
};

export type ResultField =
  | (ResolvedBase & { type: 'text' })
  | (ResolvedBase & { type: 'textarea'; rows?: number })
  | (ResolvedBase & { type: 'select'; options: ResultSelectOption[] })
  | (ResolvedBase & { type: 'file'; accept?: string[]; maxSizeMb?: number })
  | (ResolvedBase & { type: 'date'; withTime?: boolean })
  | (ResolvedBase & {
      type: 'number';
      prefix?: string;
      suffix?: string;
      decimals?: number;
    })
  | (ResolvedBase & { type: 'url' })
  | (ResolvedBase & { type: 'status'; statusOptions: ResultStatusOption[] });

export type ResultValue = {
  fieldKey: string;
  value: string | null;
  displayValue?: string;
  tone?: StatusTone;
  /*
   * A document on the record. The object key never reaches the browser — this is
   * only what the form needs to describe the file that is already there. The link
   * to open it is minted per click (`AdminResultFileLink`), after the backend's
   * own scope check (AGENTS.md, Security & PII).
   */
  file?: { name: string; sizeBytes: number | null; contentType: string | null };
  valueJson?: unknown;
};

// What `GET /v1/admin/records/:resultId/files/:fieldKey` hands back — a link that
// lives for minutes, so it is used on arrival and never stored.
export type AdminResultFileLink = {
  fieldKey: string;
  name: string;
  url: string;
  contentType: string | null;
};

// --- The result form ------------------------------------------------------

export type AdminResultStatus = 'draft' | 'active' | 'archived';

export type AdminResult = {
  id: string;
  reference: string;
  title: string;
  status: AdminResultStatus;
  orderItemId: string;
  orderId: string;
  orderReference: string;
  serviceId: string;
  serviceName: string;
  customer: { name: string; initials: string };
  // The schema staff fill in — resolved from the service, so the form is
  // entirely data-driven and a catalog change reshapes it with no deploy.
  fields: ResultField[];
  values: Record<string, ResultValue>;
  deliveredAt: string | null;
  lastEditedAt: string | null;
  /*
   * Which required fields are still blank. The Deliver button reads this rather
   * than re-deriving the rule in the browser — one definition of "ready", and
   * the backend enforces the same one on write (it is the real boundary).
   */
  missingRequired: string[];
};

export type AdminOrderItemDelivery = {
  id: string;
  serviceId: string;
  serviceName: string;
  status: AdminOrderItemStatus;
  completedAt: string | null;
  hasResultSchema: boolean;
  result: AdminResult | null;
};

// What the form submits — mirrors `resultValueInputSchema` in the backend's
// `results.validation.ts`. Every scalar is a string; the backend parses it
// against the field's own type, which is the only layer that knows the schema.
export type ResultValueInput = {
  fieldKey: string;
  value?: string | null;
  // Multi-value shapes (a file list) the scalar can't carry — the write-side
  // counterpart of `ResultValue.valueJson` above.
  valueJson?: unknown;
  objectKey?: string;
  contentType?: string;
  sizeBytes?: number;
};

// --- The follow-up queue --------------------------------------------------

export type ServiceRequestStatus =
  | 'submitted'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export const REQUEST_STATUS_OPTIONS: {
  value: ServiceRequestStatus;
  label: string;
}[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_progress', label: 'Started working' },
  // "Error" as the operator thinks of it. The customer's page words it as
  // "Needs attention", because the reason is almost always something we need
  // from them rather than something that broke.
  { value: 'blocked', label: 'Blocked / error' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export type AdminRequestRow = {
  id: string;
  reference: string;
  typeLabel: string;
  serviceName: string;
  status: ServiceRequestStatus;
  customer: { name: string; initials: string };
  assignee: { name: string; initials: string } | null;
  resultId: string;
  resultTitle: string;
  createdAt: string;
  closedAt: string | null;
};

export type AdminRequestPage = {
  rows: AdminRequestRow[];
  nextCursor: string | null;
  totalResults: number;
};

export type AdminRequestActivityEntry = {
  id: string;
  author: string;
  authorName: string;
  message: string;
  internal: boolean;
  occurredAt: string;
};

export type AdminRequestDetail = AdminRequestRow & {
  note: string | null;
  blockedReason: string | null;
  resolution: string | null;
  // The intake answers, resolved to label/value pairs server-side so the screen
  // renders them without a second registry fetch.
  answers: { label: string; value: string }[];
  activity: AdminRequestActivityEntry[];
  // The order's thread, so a request is discussed in the conversation the order
  // already has — never a second inbox.
  conversationId: string | null;
  orderId: string;
  orderReference: string;
};

// --- Catalog: a service's delivery definition -----------------------------

export type ResultFieldRef = {
  fieldKey: string;
  required?: boolean;
  // Whose value titles the record. Exactly one per service.
  isPrimary?: boolean;
  showInList?: boolean;
};

export type ServiceRequestTypeDraft = {
  id?: string;
  key: string;
  label: string;
  description?: string;
  iconKey?: string;
  turnaround?: string;
  // References into the REQUEST registry — the intake form, reusing the same
  // vocabulary the order form asks from.
  fields?: { fieldKey: string; required?: boolean }[];
  active: boolean;
};
