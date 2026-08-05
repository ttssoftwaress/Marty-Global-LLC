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
 * The customer a room belongs to. `initials` comes from the API rather than
 * being sliced off the name here, so names a naive split would mangle still
 * render correctly.
 */
export type MailOpsCustomer = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

/*
 * The room picker's two steps.
 *
 * The target is the room rather than the customer, because a customer may hold
 * several (a Delaware address and a Wyoming one) and an envelope arrives at
 * exactly one of them. And the pick takes two steps because a room name is not
 * unique — "Main Office" belongs to as many customers as chose it — so the
 * operator names the room, then picks among the addresses carrying that name.
 */

// Step one: a room name, and how many active rooms answer to it. The count tells
// the operator whether the next step is a real choice.
export type MailOpsRoomName = {
  name: string;
  rooms: number;
};

// Step two: one addressable room. The customer travels with it — an address
// alone does not say whose mail room it is.
export type MailOpsRoom = {
  id: string;
  name: string;
  address: string;
  customer: MailOpsCustomer;
};

/*
 * Which room a listed piece of mail belongs to — just enough to label the row
 * with the address the post arrived at, not the full room record.
 */
export type MailOpsRoomRef = {
  id: string;
  name: string;
};

/*
 * One row of the "Recently uploaded" feed: who it was filed to, which of their
 * rooms it landed in, what the sender was, and when. `uploadedAt` is ISO-8601
 * UTC and is converted to the viewer's zone only at render (AGENTS.md, Dates).
 */
export type MailOpsRecentUpload = {
  id: string;
  customer: MailOpsCustomer;
  room: MailOpsRoomRef;
  sender: string;
  uploadedAt: string; // ISO-8601 UTC
};

/*
 * One uploaded file of a scan. The bytes go to R2 through `services/upload.ts`
 * (AGENTS.md, Storage); this carries the resulting object key rather than the
 * file, so the JSON request stays small and nothing round-trips through the API.
 *
 * `contentType` travels with it because the customer's viewer needs it to pick a
 * renderer — an image page is drawn inline, a PDF is handed to the browser whole.
 */
export type MailScanFile = {
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes?: number;
};

/*
 * The upload form's payload.
 *
 * `roomId` — not a customer id: the scan is filed into the specific room the
 * envelope arrived at, and the backend resolves the customer from it.
 *
 * `files` is ordered — position becomes the page number — because an envelope is
 * rarely one file: an operator scans several sheets, or attaches a multi-page
 * PDF among them.
 *
 * `receivedOn` is a plain calendar date (`yyyy-MM-dd`) — the day the physical
 * mail was received, which has no time-of-day and must not be built from a
 * zoneless timestamp (AGENTS.md, Dates).
 *
 * `responseDueOn` is the same kind of date, and it is what turns filed post into
 * post the customer must answer: with it the backend files the item as "Action
 * requested" and their inbox prints "Response needed by …". It requires `notes`
 * — that is the reason shown beside the deadline.
 */
/*
 * What the operator is filing.
 *
 * `envelope` is the normal case and the form's default: post is logged sealed
 * from the outside, the customer sees it and presses Scan, and the contents are
 * filed onto that same item later. `contents` covers post the customer has
 * standing instructions to open, filed already opened in one step.
 */
export type MailFilingKind = 'envelope' | 'contents';

export type MailScanDraft = {
  roomId: string;
  kind: MailFilingKind;
  sender: string;
  receivedOn: string; // yyyy-MM-dd
  files: MailScanFile[];
  notes?: string;
  responseDueOn?: string; // yyyy-MM-dd
};

/*
 * Opening a sealed envelope and filing what was inside it onto the mail item
 * already sitting in the customer's inbox.
 *
 * No room and no sender: the item exists and carries both. Re-sending them would
 * let a scan be filed against one envelope under another's identity — and it is
 * the item, not a new record, that this has to land on, because a second item
 * would show the customer the same letter twice.
 */
export type MailContentsDraft = {
  itemId: string;
  files: MailScanFile[];
  notes?: string;
  responseDueOn?: string; // yyyy-MM-dd
};

// A scan the operator has attached but not yet uploaded.
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
export type MailRequestType = 'forwarding' | 'shredding' | 'scan';

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
  'all' | 'scan' | 'forwarding' | 'shredding' | 'completed';

// Scanning leads the strip because it is the queue with a physical envelope
// waiting on it — the only one where nothing moves until an operator acts.
export const MAIL_REQUEST_FILTERS: {
  value: MailRequestFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'scan', label: 'Open & scan' },
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
  // Which of the customer's rooms the item arrived at — an operator working the
  // queue needs the address, not only whose post it is.
  room: MailOpsRoomRef;
  mailItem: string;
  /*
   * The mail item behind the request. A scan request is settled by filing the
   * contents onto that item, so the panel needs its id; the other two never
   * address the item directly and only name it.
   */
  mailItemId: string;
  type: MailRequestType;
  typeLabel: string;
  status: MailRequestStatus;
  statusLabel: string;
  requestedAt: string; // ISO-8601 UTC
};

/*
 * One page of the queue, cursor-paginated like every other admin list
 * (AGENTS.md). The design's footer prints "Showing 1–10 of 34" and a numbered
 * page strip, which the totals returned beside the cursor answer — the strip
 * windows over the stream rather than stepping an offset.
 */
export type MailRequestPage = {
  requests: MailRequestRow[];
  nextCursor: string | null;
  page: number;
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
 * `shippingAddress` is the customer's forwarding address (its label everywhere
 * in the UI) — a pre-composed single line resolved server-side, so the client
 * never assembles an address from parts (formats differ by country and the
 * backend already holds the customer's on file). It is null on a shredding
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
  room: MailOpsRoomRef;
  mailItem: string;
  action: MailLogAction;
  actionLabel: string;
  closedAt: string; // ISO-8601 UTC
  processedBy: string;
};

/*
 * One closed entry in full — what the log's expanded row reads.
 *
 * Off the list on purpose: it is three joins deep (the item, its pages, every
 * request raised against it) and the log is the longest table in the admin
 * area, so only the row somebody opens pays for them.
 *
 * Every request is listed, not only the one that closed the entry. A forwarding
 * that follows a scan request is the usual sequence, and "why did this leave the
 * building?" is answered by the sequence rather than by the last row.
 */
export type MailLogEntryDetail = MailLogRow & {
  mailItemId: string;
  item: {
    sender: string;
    status: string;
    statusLabel: string;
    receivedAt: string; // ISO-8601 UTC
    storageExpiresAt: string;
    scanReady: boolean;
    note: string | null;
    pageCount: number;
  };
  requests: {
    id: string;
    type: MailRequestType;
    typeLabel: string;
    status: MailRequestStatus;
    statusLabel: string;
    requestedAt: string;
    processedAt: string | null;
    processedBy: string | null;
    shippingAddress: string | null;
    carrier: string | null;
    trackingNumber: string | null;
    notes: string | null;
  }[];
};

/*
 * One page of the log, cursor-paginated for the same reason the pending queue
 * is: the footer prints "Showing 1–8 of 120 items" and a numbered strip, both
 * derived from the totals the endpoint returns beside the cursor.
 */
export type MailLogPage = {
  entries: MailLogRow[];
  nextCursor: string | null;
  page: number;
  totalResults: number;
  totalPages: number;
};

// The accepted types and size ceiling for a scan live in constants/uploads.ts,
// mirrored from the backend's `mail-scan` policy — the copies that used to sit
// here had drifted to a 10 MB cap the endpoint does not impose.
