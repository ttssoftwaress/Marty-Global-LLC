/*
 * Admin support inbox — local mirror of the API shapes the staff conversation
 * screen renders. The backend is the source of truth (AGENTS.md, two-apps sync
 * rule); these types exist so the UI compiles and composes before the `support`
 * module's admin endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the header counts, the
 * filter tabs, every conversation, message, and internal note, and the
 * assignable staff list all arrive from the API.
 */

/*
 * The filter strip above the conversation list. A closed union (rather than free
 * strings) is what lets the screen hold one in the URL and read it back without
 * validating against the server first.
 *
 * The desktop link shows four tabs and the tablet link three — desktop is the
 * source of truth for copy and content (Design.md), so `resolved` is present at
 * every width and the strip scrolls when it does not fit.
 */
export type SupportFilter = 'all' | 'unassigned' | 'assigned' | 'resolved';

export const SUPPORT_FILTERS: { value: SupportFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'resolved', label: 'Resolved' },
];

export const DEFAULT_SUPPORT_FILTER: SupportFilter = 'all';

export function isSupportFilter(value: unknown): value is SupportFilter {
  return SUPPORT_FILTERS.some((filter) => filter.value === value);
}

/*
 * A conversation's workflow state. `open` and `resolved` are the two the design
 * shows in the header capsule; `pending` covers a thread waiting on the
 * customer, which the backend can already return without a frontend deploy.
 *
 * `statusLabel` on the record is the backend's word for the state, so the map
 * that pairs a state with its hue is all the frontend owns.
 */
export type SupportStatus = 'open' | 'pending' | 'resolved';

/*
 * A staff member a conversation can be assigned to. `initials` comes from the
 * backend rather than being sliced off the name here, so names a naive split
 * would mangle still render correctly — the same rule the customers list follows.
 */
export type SupportAgent = {
  id: string;
  name: string;
  initials: string;
  shortName: string; // "Marcus T." — what the narrow capsules and list rows print
};

/*
 * One row in the conversation list.
 *
 * `subject` is the order/service line under the name and `preview` the last
 * message's opening — both come down resolved, so the list never has to reach
 * into a thread it has not loaded. `unread` drives the leading dot.
 *
 * `assignee` is null for an unassigned thread, which is what the amber
 * "Unassigned" line in its place means.
 */
export type SupportConversationSummary = {
  id: string;
  customerName: string;
  customerInitials: string;
  /*
   * A website visitor rather than an account holder — a thread opened from the
   * marketing site's chat bubble. It is routed exactly like any other help
   * request, so it lives in the same queue; the badge exists because the agent
   * should know there is no customer record behind it and no portal to point at.
   */
  isGuest: boolean;
  subject: string;
  preview: string;
  lastMessageAt: string; // ISO-8601 UTC
  unread: boolean;
  status: SupportStatus;
  assignee: SupportAgent | null;
};

/*
 * One page of the conversation list. Cursor pagination is the API convention
 * (AGENTS.md), so `nextCursor` drives the list pane's infinite scroll.
 *
 * `totalOpen` and `totalUnassigned` back the amber header pill; they are counts
 * over the whole inbox, not the loaded page, so the pill stays truthful as the
 * list pages in.
 */
export type SupportConversationsPage = {
  conversations: SupportConversationSummary[];
  nextCursor: string | null;
  totalOpen: number;
  totalUnassigned: number;
};

/*
 * One entry in an open thread.
 *
 * Three authorships render differently: the reader's own messages (right,
 * brand-tinted bubble), everyone else's (left, gray bubble), and an internal note
 * (the full-width amber block that is never visible to the customer). Modelling
 * the note as a message kind rather than a separate list keeps the thread in one
 * chronological stream, which is how the design reads it.
 *
 * `authorName` is the backend's word for who spoke; the frontend adds no title
 * of its own beyond the "— Support" suffix the design gives staff replies.
 */
export type SupportMessageKind = 'customer' | 'staff' | 'internal_note';

export type SupportMessage = {
  id: string;
  kind: SupportMessageKind;
  /*
   * Which side of the thread this bubble sits on. Resolved per-viewer by the
   * backend, so it means "I wrote this", not "my side wrote this" — `kind` cannot
   * stand in for it, because every agent's reply is `staff` and only one of them
   * is the reader's. A second agent joining a thread sees the first agent's
   * replies on the left, exactly as the customer sees them.
   */
  mine: boolean;
  authorName: string;
  authorInitials: string;
  body: string;
  sentAt: string; // ISO-8601 UTC
  /*
   * Whether the customer has read this reply. Set on staff replies only — a tick
   * under the customer's own message would report the agent's reading back to
   * the agent — and absent on an internal note, which has no other side.
   */
  seen?: boolean;
  // Local-only: drawn optimistically, not yet confirmed by the server. Carries
  // the id the send was tagged with so the delivered copy replaces it.
  pending?: boolean;
  clientId?: string;
};

/*
 * An open conversation: who it is with, what it is about, and its messages.
 *
 * `orderReference` / `orderTo` are the "#ORD-2847" link in the thread header —
 * both null when a conversation is not tied to an order, in which case the
 * header prints the subject alone rather than a dead link.
 *
 * `assignableAgents` comes with the thread so the assignee menu can open without
 * a second round trip, and so staff who may not take this conversation are never
 * offered.
 */
export type SupportThread = {
  id: string;
  customerName: string;
  customerInitials: string;
  customerFirstName: string; // the composer's "Type your reply to Sarah..."
  // A website visitor with no account. The header shows the email they gave
  // instead of a link to a customer record that does not exist.
  isGuest: boolean;
  guestEmail: string | null;
  subject: string;
  orderReference: string | null;
  orderTo: string | null;
  status: SupportStatus;
  statusLabel: string;
  assignee: SupportAgent | null;
  assignableAgents: SupportAgent[];
  messages: SupportMessage[];
};

/*
 * What the composer is writing. The two tabs are a real mode switch, not a
 * styling choice: a reply reaches the customer, a note never does.
 */
export type ComposerMode = 'reply' | 'note';
