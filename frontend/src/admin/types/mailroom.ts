/*
 * Admin virtual mail ops — local mirror of the API shapes the screen renders.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule); these
 * types exist so the UI compiles and composes before the `mailroom` module's
 * admin endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the three KPI figures, the
 * tab counts, the customer search results, and the recently-uploaded feed all
 * arrive from the API.
 */

/*
 * The screen's four sections. `upload` and `pending` are designed; `log` and
 * `settings` are the sections the same module will serve once their screens
 * exist, and the tab strip carries their counts from the summary so the
 * operator can see the backlog without switching.
 */
export type MailOpsTab = 'upload' | 'pending' | 'log' | 'settings';

export type MailOpsTabItem = {
  value: MailOpsTab;
  label: string;
  count: number | null; // null prints no badge
};

export const MAIL_OPS_TABS: { value: MailOpsTab; label: string }[] = [
  { value: 'upload', label: 'Upload mail' },
  { value: 'pending', label: 'Pending requests' },
  { value: 'log', label: 'Mail log' },
  { value: 'settings', label: 'Settings' },
];

/*
 * A headline figure. `value` arrives pre-resolved as the string to print, so
 * the UI never counts or aggregates anything itself.
 */
export type MailOpsKpi = {
  id: string;
  label: string;
  value: string;
};

/*
 * Everything the chrome needs in one call, so the KPI figures and the tab
 * counts always agree with each other and with the lists behind them.
 */
export type MailOpsSummary = {
  kpis: MailOpsKpi[];
  tabs: MailOpsTabItem[];
};

/*
 * A customer the scan can be filed against. `initials` comes from the API
 * rather than being sliced off the name here, so names a naive split would
 * mangle still render correctly.
 */
export type MailOpsCustomer = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

/*
 * One row of the "Recently uploaded" feed: who it was filed to, what the sender
 * was, and when it landed. `uploadedAt` is ISO-8601 UTC and is converted to the
 * viewer's zone only at render (AGENTS.md, Dates).
 */
export type MailOpsRecentUpload = {
  id: string;
  customer: MailOpsCustomer;
  sender: string;
  uploadedAt: string; // ISO-8601 UTC
};

/*
 * The upload form's payload. The scan itself is uploaded separately through
 * `services/upload.ts` to R2 (AGENTS.md, Storage); this carries the resulting
 * object key rather than the bytes, so the JSON request stays small and the
 * file never round-trips through the API process.
 *
 * `receivedOn` is a plain calendar date (`yyyy-MM-dd`) — the day the physical
 * mail was received, which has no time-of-day and must not be built from a
 * zoneless timestamp (AGENTS.md, Dates).
 */
export type MailScanDraft = {
  customerId: string;
  sender: string;
  receivedOn: string; // yyyy-MM-dd
  scanKey: string;
  notes?: string;
};

// The scan the operator has attached but not yet submitted.
export type MailScanAttachment = {
  name: string;
  size: number; // bytes
};

/*
 * ---------------------------------------------------------------------------
 * Pending requests — the forwarding / shredding queue.
 * ---------------------------------------------------------------------------
 */

/*
 * What the customer asked us to do with a piece of mail. The badge's glyph and
 * tint are derived from this, so a new kind added server-side surfaces as a
 * neutral badge rather than an unstyled one.
 */
export type MailRequestType = 'forwarding' | 'shredding';

/*
 * Where the request has got to. `pending` is waiting on an operator,
 * `processing` is in flight, `completed` is done — the three the design draws.
 */
export type MailRequestStatus = 'pending' | 'processing' | 'completed';

/*
 * The queue's filter strip. `all` is not a status — it clears the filter — so
 * it is kept separate from `MailRequestStatus` rather than widened into it.
 */
export type MailRequestFilter =
  'all' | 'forwarding' | 'shredding' | 'completed';

export const MAIL_REQUEST_FILTERS: {
  value: MailRequestFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'forwarding', label: 'Forwarding' },
  { value: 'shredding', label: 'Shredding' },
  { value: 'completed', label: 'Completed' },
];

/*
 * One row of the queue. `requestedAt` is ISO-8601 UTC and is converted to the
 * viewer's zone only at render (AGENTS.md, Dates).
 *
 * `typeLabel` and `statusLabel` arrive resolved from the API so the wording
 * stays server-owned; the enums above only pick the tint and the glyph.
 */
export type MailRequestRow = {
  id: string;
  customer: MailOpsCustomer;
  mailItem: string;
  type: MailRequestType;
  typeLabel: string;
  status: MailRequestStatus;
  statusLabel: string;
  requestedAt: string; // ISO-8601 UTC
};

/*
 * One page of the queue. The list is offset-paginated rather than
 * cursor-paginated: the design's footer prints "Showing 1–10 of 34" and a
 * numbered page strip, neither of which a cursor can answer.
 */
export type MailRequestPage = {
  requests: MailRequestRow[];
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
};

/*
 * The scan behind a request, as the slide-over's document card renders it.
 *
 * `previewUrl` is a short-TTL presigned R2 URL the service issues only after an
 * auth + ownership check (AGENTS.md, Security & PII), so it is nullable: a scan
 * still being processed has a filename but nothing to open yet, and the card's
 * "Preview document" disables rather than pointing at a dead link.
 */
export type MailRequestDocument = {
  fileName: string;
  previewUrl: string | null;
};

/*
 * The carrier options the forwarding form's select offers. The list is
 * server-owned rather than a frontend constant: which carriers the mail room
 * actually ships with is an operational fact, not a UI one, and it changes
 * without a deploy.
 */
export type MailCarrierOption = {
  value: string;
  label: string;
};

/*
 * Everything the slide-over shows for one request — the queue row plus the
 * parts only the detail view needs.
 *
 * `shippingAddress` is a pre-composed single line resolved server-side, so the
 * client never assembles an address from parts (formats differ by country and
 * the backend already holds the customer's on file). It is null on a shredding
 * request, which has nowhere to ship to — the design's shredding panel drops
 * that row entirely.
 *
 * `carriers` arrives with the detail rather than from a separate call, so the
 * form has its options the moment the panel opens.
 */
export type MailRequestDetail = MailRequestRow & {
  document: MailRequestDocument;
  shippingAddress: string | null;
  carriers: MailCarrierOption[];
};

/*
 * What the operator submits to settle a request.
 *
 * One shape for both types rather than a union: the two forms differ only by
 * which fields they collect (forwarding adds the tracking number and carrier),
 * and the backend decides what a settlement means for the request's type — the
 * client only reports what was entered (AGENTS.md — business logic in services).
 */
export type MailRequestResolution = {
  requestId: string;
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
};

/*
 * ---------------------------------------------------------------------------
 * Mail log — the closed history of everything the mail room has handled.
 * ---------------------------------------------------------------------------
 */

/*
 * How a piece of mail was finally disposed of. This is the outcome a request
 * settled on, not its progress: the log only holds closed items, so there is no
 * pending state here — that lives on `MailRequestStatus` above.
 *
 * `downloaded` covers mail the customer only ever pulled the scan for, which the
 * design prints as "Downloaded only".
 */
export type MailLogAction = 'forwarded' | 'shredded' | 'downloaded';

/*
 * The log's "Request type" filter. `all` is not an action — it clears the
 * filter — so it is kept separate rather than widened into `MailLogAction`.
 */
export type MailLogActionFilter = 'all' | MailLogAction;

export const MAIL_LOG_ACTION_FILTERS: {
  value: MailLogActionFilter;
  label: string;
}[] = [
  { value: 'all', label: 'Request type' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'shredded', label: 'Shredded' },
  { value: 'downloaded', label: 'Downloaded only' },
];

/*
 * The log's date-range filter. The windows are named rather than a free date
 * pair because the design's control is a single select; the backend resolves
 * each name to real bounds, so the client never builds a deadline or a range
 * from a zoneless string (AGENTS.md, Dates).
 */
export type MailLogDateRange = 'all' | '7d' | '30d' | '90d';

export const MAIL_LOG_DATE_RANGES: {
  value: MailLogDateRange;
  label: string;
}[] = [
  { value: 'all', label: 'Date range' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

// Everything the log list is narrowed by, in one object the query keys on.
export type MailLogFilters = {
  search: string;
  range: MailLogDateRange;
  action: MailLogActionFilter;
};

/*
 * One closed item. `closedAt` is ISO-8601 UTC and is converted to the viewer's
 * zone only at render (AGENTS.md, Dates).
 *
 * `actionLabel` arrives resolved from the API so the wording stays server-owned;
 * the enum above only picks the tint and the glyph. `processedBy` is the staff
 * member who settled it — a plain name, since the log shows no staff avatar.
 */
export type MailLogRow = {
  id: string;
  customer: MailOpsCustomer;
  mailItem: string;
  action: MailLogAction;
  actionLabel: string;
  closedAt: string; // ISO-8601 UTC
  processedBy: string;
};

/*
 * One page of the log. Offset-paginated for the same reason the pending queue
 * is: the footer prints "Showing 1–8 of 120 items" and a numbered strip, neither
 * of which a cursor can answer.
 */
export type MailLogPage = {
  entries: MailLogRow[];
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
};

export const SCAN_ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export const SCAN_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the drop-zone copy
