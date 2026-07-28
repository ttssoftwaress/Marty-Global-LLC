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
 * source of truth for copy and content (Design.md), so the strip is complete at
 * every width and scrolls when it does not fit.
 *
 * Which four a given member is OFFERED is not a frontend decision: a supervisor
 * reads the whole queue, so "Unassigned" and "Assigned" answer their question,
 * while an agent's inbox is by definition the chats assigned to them and gets the
 * workflow states instead. The list response carries the right set (`filters`),
 * for the same reason the permission grid comes from the API — who sees which
 * cohorts is an authorization question.
 */
export type SupportFilter =
  | 'all'
  | 'unassigned'
  | 'assigned'
  | 'open'
  | 'pending'
  | 'resolved';

export type SupportFilterOption = { value: SupportFilter; label: string };

// Every value the backend will accept. Used to validate `?filter=` off the URL
// before any response has arrived, never to decide which tabs to draw.
const SUPPORT_FILTER_VALUES: SupportFilter[] = [
  'all',
  'unassigned',
  'assigned',
  'open',
  'pending',
  'resolved',
];

/*
 * What the strip renders until the first page lands. `all` is in both server-side
 * sets, so the tab that is selected on arrival is never one that then disappears.
 */
export const SUPPORT_FILTERS_FALLBACK: SupportFilterOption[] = [
  { value: 'all', label: 'All' },
];

export const DEFAULT_SUPPORT_FILTER: SupportFilter = 'all';

export function isSupportFilter(value: unknown): value is SupportFilter {
  return SUPPORT_FILTER_VALUES.some((filter) => filter === value);
}

/*
 * How much of the queue this member is looking at. `assigned` is an agent, who
 * sees only the chats routed to them; `all` is a supervisor. The backend decides
 * it and sends it down — the header prints it rather than deriving it from a
 * role, because "12 open" and "12 open assigned to you" are the same figure
 * meaning very different things.
 */
export type SupportScope = 'all' | 'assigned';

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
 * list pages in. Both are scoped like the list itself — an agent's "open" is
 * their own, and their "unassigned" is zero by construction.
 */
export type SupportConversationsPage = {
  conversations: SupportConversationSummary[];
  nextCursor: string | null;
  totalOpen: number;
  totalUnassigned: number;
  scope: SupportScope;
  // Whether this member may move a chat between agents (`support.assign`).
  canAssign: boolean;
  filters: SupportFilterOption[];
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

/*
 * A file sent with a message — in practice, something the customer attached.
 *
 * `href` is a short-TTL presigned link the backend mints on the read that
 * returned this message, after its own access check (AGENTS.md, Security & PII).
 * It can be absent — an unconfigured bucket, or a signature that failed — which
 * the chip renders as a name without a link rather than a dead href.
 */
export type SupportMessageAttachment = {
  id: string;
  name: string;
  size: number; // bytes
  href?: string;
};

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
  // Files sent with the message. Absent on most of them, which is why the thread
  // renders the chips only when there is something to render.
  attachments?: SupportMessageAttachment[];
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
 * offered. It is empty for a member without `canAssign` — the two travel together
 * so the capsule can say "not by you" rather than "nobody to assign to".
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
  /*
   * Whether this member may reassign the thread. Incoming chats are routed
   * automatically and balanced across the team, so overriding that routing is a
   * supervisor's call — the exact mirror of `canAssign` on an order.
   *
   * The backend decides it: the disabled control and the endpoint's 403 have to
   * agree, and the endpoint is the real boundary (AGENTS.md, Auth).
   */
  canAssign: boolean;
  messages: SupportMessage[];
};

/*
 * What the composer is writing. The two tabs are a real mode switch, not a
 * styling choice: a reply reaches the customer, a note never does.
 */
export type ComposerMode = 'reply' | 'note';
