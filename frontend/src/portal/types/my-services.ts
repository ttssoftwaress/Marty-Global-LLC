import type { ServiceIconKey } from './order-new-service';

/*
 * Delivered services — the customer's per-service pages, and the follow-up
 * requests raised from them.
 *
 * A local mirror of the backend's wire contract (AGENTS.md: nothing is shared;
 * the backend defines it, this app mirrors it, both change in the same task).
 * The source is `backend/src/modules/results/results.validation.ts` and the view
 * shapes in `results.service.ts`.
 *
 * The whole surface is data-driven: neither the columns of a service's table nor
 * the sections of its detail page are declared here. The backend sends the
 * resolved field schema and this app renders it by `type`, exactly as the order
 * form renders its own questions — so adding "Company Formation" as a service
 * with six returned facts is a catalog change, not a frontend deploy.
 */

// --- Fields ---------------------------------------------------------------

/*
 * The controls a delivered fact takes. The request form's four, plus four that
 * only make sense as output — `date` and `number` are formatted at render in the
 * viewer's own locale and zone (AGENTS.md, Dates), `url` renders as an anchor,
 * and `status` as a coloured chip.
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

// A status chip's meaning, not its colour. The backend picks from a closed set
// and this app maps each to a design token — an admin never chooses a hex
// (Design.md: no hardcoded hex).
export type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

export type ResultSelectOption = { value: string; label: string };
export type ResultStatusOption = ResultSelectOption & { tone: StatusTone };

type ResultFieldBase = {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  // The card this fact is grouped under on the detail page.
  category?: string;
  // The fact whose value titles the record — the table's first column and the
  // detail page's heading.
  isPrimary?: boolean;
  showInList?: boolean;
};

export type ResultField =
  | (ResultFieldBase & { type: 'text' })
  | (ResultFieldBase & { type: 'textarea'; rows?: number })
  | (ResultFieldBase & { type: 'select'; options: ResultSelectOption[] })
  | (ResultFieldBase & { type: 'file'; accept?: string[]; maxSizeMb?: number })
  | (ResultFieldBase & { type: 'date'; withTime?: boolean })
  | (ResultFieldBase & {
      type: 'number';
      prefix?: string;
      suffix?: string;
      decimals?: number;
    })
  | (ResultFieldBase & { type: 'url' })
  | (ResultFieldBase & { type: 'status'; statusOptions: ResultStatusOption[] });

/*
 * One delivered value.
 *
 * `value` is the stored scalar, untouched — formatting a date or grouping a
 * number is this app's job at render. `displayValue` and `tone` carry what the
 * browser cannot derive: the label behind a select's stored value, and the tone
 * behind a status's.
 */
export type ResultValue = {
  fieldKey: string;
  value: string | null;
  displayValue?: string;
  tone?: StatusTone;
  file?: { name: string; sizeBytes: number | null; contentType: string | null };
  valueJson?: unknown;
};

// --- Services the customer owns ------------------------------------------

// One sidebar entry, and the header of that service's page.
export type CustomerServiceSummary = {
  serviceId: string;
  slug: string;
  name: string;
  // "My companies" — the page's heading, distinct from what the thing is called
  // when you buy it.
  pageTitle: string;
  // The word for one record ("company"), used in empty states and counts.
  noun: string;
  iconKey: ServiceIconKey;
  count: number;
};

// --- The list page --------------------------------------------------------

export type ServiceResultStatus = 'active' | 'archived';

export type ServiceResultRow = {
  id: string;
  reference: string;
  title: string;
  status: ServiceResultStatus;
  orderId: string;
  orderReference: string;
  deliveredAt: string | null;
  updatedAt: string;
  // Keyed by field name, for whichever columns the schema names.
  values: Record<string, ResultValue>;
  openRequests: number;
};

export type ServiceResultList = {
  service: CustomerServiceSummary;
  // The columns this service's table prints, in order. Rendered as sent — never
  // a hardcoded column set.
  columns: ResultField[];
  rows: ServiceResultRow[];
  nextCursor: string | null;
  totalResults: number;
};

// --- The detail page ------------------------------------------------------

export type ServiceRequestStatus =
  | 'submitted'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export type ServiceRequestSummary = {
  id: string;
  reference: string;
  typeLabel: string;
  status: ServiceRequestStatus;
  note: string | null;
  // Why it cannot proceed — shown to the customer in place of progress.
  blockedReason: string | null;
  resolution: string | null;
  assigneeName: string | null;
  createdAt: string;
  closedAt: string | null;
};

/*
 * The intake form behind a request button. Deliberately the REQUEST field shape
 * (the one the order form already renders), not the result one — asking "which
 * address should we ship to?" reuses the vocabulary that already exists.
 */
export type RequestFormField = {
  name: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'file';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: ResultSelectOption[];
  rows?: number;
  accept?: string[];
  maxSizeMb?: number;
  multiple?: boolean;
};

export type RequestType = {
  id: string;
  key: string;
  label: string;
  description?: string;
  iconKey?: string;
  turnaround?: string;
  // Empty raises the request immediately with no form.
  fields: RequestFormField[];
};

export type ServiceResultDetail = {
  id: string;
  reference: string;
  title: string;
  status: ServiceResultStatus;
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  pageTitle: string;
  orderId: string;
  orderReference: string;
  deliveredAt: string | null;
  lastEditedAt: string | null;
  // Grouped by the admin's category, so the page renders cards rather than one
  // flat list.
  sections: { title: string; fields: ResultField[] }[];
  values: Record<string, ResultValue>;
  // Short-TTL presigned links, minted per request after an ownership check
  // (AGENTS.md, Security & PII) — a missing entry means "not available yet".
  downloads: Record<string, string>;
  requestTypes: RequestType[];
  requests: ServiceRequestSummary[];
  // The order's thread, so this page carries the same conversation the order
  // detail screen does — never a second inbox.
  conversationId: string | null;
};

export type ServiceRequestListItem = ServiceRequestSummary & {
  resultId: string;
  resultTitle: string;
};
