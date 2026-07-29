/*
 * Virtual mail rooms — local mirror of the API shapes the mail-room screen
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * these types exist so the UI compiles and composes before the endpoints land.
 *
 * No amounts here — a mail room carries counts and a renewal date, not money.
 * Dates stay ISO-8601 UTC and are formatted only at render (AGENTS.md, Dates).
 */

// The design shows `active` (green). `pending` covers a room being provisioned
// and `suspended` a lapsed/held room, so the chip has a state for each rather
// than falling through.
export type MailRoomStatus = 'active' | 'pending' | 'suspended';

export type MailRoom = {
  id: string;
  name: string; // "Main Office"
  address: string; // full one-line address
  status: MailRoomStatus;
  newMail: number; // unread scanned items — "New mail: 3"
  pendingRequests: number; // outstanding forwarding/scan requests — "Pending: 1"
  renewsAt: string; // ISO-8601 UTC — "Renews Mar 12, 2027"
};

/*
 * What the customer asked us to do with a piece of mail — the two buttons on the
 * item viewer. The request lands in the admin mail-ops queue; the backend
 * decides what happens next and what the item's status becomes, so this is only
 * the receipt for having asked.
 *
 * The forwarding address is deliberately not part of the payload or the reply:
 * the backend resolves it from the customer's own company record, so it is never
 * something the client chooses or needs to hold.
 */
export type MailRequestType = 'forwarding' | 'shredding';

export type MailRequest = {
  id: string;
  mailItemId: string;
  type: MailRequestType;
  status: string;
  requestedAt: string; // ISO-8601 UTC
};

// The three headline figures across the top of the page.
export type MailRoomStats = {
  totalRooms: number;
  unreadMail: number;
  pendingRequests: number;
};

// The single overview payload: the KPI figures and the customer's rooms. The
// backend scopes everything to the signed-in customer.
export type MailRoomOverview = {
  stats: MailRoomStats;
  rooms: MailRoom[];
};

// ─── A single room's inbox ──────────────────────────────────────────────────

// A scanned mail item's lifecycle. Labels come from the desktop link (the copy
// source): "Viewed" (not the mobile "Opened"), "Action requested" (not the
// mobile "Action required"). `new`/`forwarded` read as the navy pill, `viewed`/
// `archived` as the neutral pill, and `action_requested` as the red pill that
// swaps the row's action to "Respond".
//
// The links also draw a green "Scanned" pill. It is deliberately not here: the
// backend has no such state and cannot have one — whether the scan is ready is
// `scanReady` below, and the row already renders that as a "Scanning" preview,
// so a status of the same name would be a second answer to the same question.
export type MailStatus =
  | 'new'
  | 'viewed'
  | 'forwarded'
  | 'action_requested'
  | 'archived';

// A single piece of scanned mail inside a room. The inbox list reads the top
// fields; the scan pages and PDF (short-TTL presigned URLs served only after an
// ownership check, AGENTS.md Security & PII) are for the item's detail view and
// arrive once the scan finishes — `scanReady` is false while it still processes.
export type MailItem = {
  id: string;
  sender: string; // "State Registry Office" / "Unknown Sender"
  receivedAt: string; // ISO-8601 UTC
  storageExpiresAt: string; // ISO-8601 UTC — the shred date unless forwarding is requested
  status: MailStatus;
  scanReady: boolean; // false → the scan is still processing ("Scanning" preview)
  note?: string; // e.g. "Forwarding address required" — the reason an item needs action
  responseDueAt?: string; // ISO-8601 UTC — the deadline for an action-requested item
  /*
   * The customer has already asked us to forward or shred this item and we
   * haven't settled it yet. An item reads as `action_requested` in both
   * directions — us waiting on them, and them waiting on us — so this is what
   * separates the two: with an open request there is nothing left for the
   * customer to respond to, and the row keeps its plain "View" action.
   */
  hasOpenRequest?: boolean;
  scanPages?: string[]; // presigned page-image URLs, in order — for the detail view
  pdfUrl?: string; // presigned PDF download, once available
  /*
   * Every file the operator attached, each with its own short-lived link.
   *
   * `scanPages` above is the subset the viewer can draw inline (the images);
   * this is the complete set, so a PDF filed alongside them is still reachable.
   * No object key is ever included — only the URL, minted per request.
   */
  files?: MailItemFile[];
};

// One uploaded file of a scan. `contentType` is what tells the viewer whether to
// draw it inline or hand it to the browser.
export type MailItemFile = {
  name: string;
  contentType: string | null;
  sizeBytes: number | null;
  url: string;
};

// The three headline figures across the top of a room's inbox.
export type MailRoomInboxStats = {
  newMail: number;
  pendingRequests: number;
  totalItems: number;
};

// The room this inbox belongs to: its name + address for the header and its
// headline figures. The mail items are a separate paginated query.
export type MailRoomDetail = {
  id: string;
  name: string; // "Main Office"
  address: string; // full one-line address
  stats: MailRoomInboxStats;
};

// A room's three sub-views. Only the inbox is built out here; requests and
// history land later (AGENTS.md, two-apps sync rule).
export type MailRoomTab = 'inbox' | 'requests' | 'history';

// The status filter over the inbox. `all` clears it; the rest map to a
// MailStatus the backend filters by.
export type MailStatusFilter = 'all' | MailStatus;

// One page of a room's mail items. Cursor-paginated (AGENTS.md); the backend
// resolves the tab, status filter, search, counts, and window.
export type MailItemsPage = {
  items: MailItem[];
  totalItems: number; // total matching the current filters, for "Showing X of Y"
  totalPages: number;
  nextCursor: string | null;
};
