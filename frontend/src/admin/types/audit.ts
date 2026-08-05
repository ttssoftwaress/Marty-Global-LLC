/*
 * Admin audit log — local mirror of the API shapes this screen renders. The
 * backend is the source of truth (AGENTS.md, two-apps sync rule).
 *
 * The screen is read-only, and the types say so: there is no write payload here
 * and there is no endpoint behind one. An audit entry is written by the backend's
 * recording layer and never edited or deleted, which is what makes the trail
 * usable as evidence.
 *
 * Nothing on the screen is a frontend constant. The category tabs, the action
 * dropdown, and every row's wording all arrive from the API — adding an audited
 * event is a backend change, the same rule the team screen's permission grid
 * follows.
 */

/*
 * How prominently a row reads. Derived by the backend from the action, not
 * stored on the entry, so re-classifying an event never needs a migration over
 * history.
 *
 * `alert` is the handful an admin should never scroll past — a failed sign-in, a
 * payment that did not reconcile, any change to who holds access. `notice` marks
 * writes that move money or grant something. Everything else is `normal`, which
 * is most of the table; tinting it would make the signal mean nothing.
 */
export type AuditSeverity = 'normal' | 'notice' | 'alert';

/*
 * A filter option — a category tab or an action in the dropdown. Values are
 * opaque to the UI and go back to the API verbatim as a query param.
 */
export type AuditCategoryOption = {
  value: string;
  label: string;
  count?: number;
};

export type AuditActionOption = {
  value: string;
  label: string;
  category: string;
};

export const ALL_CATEGORIES = 'all';
export const ALL_ACTIONS = 'all';

/*
 * Who acted.
 *
 * Two of the three kinds have no `id`, and they are NOT the same thing:
 *
 *   - `system` — a job processor crediting a payment or sweeping reminders.
 *     Nobody did it; the system did.
 *   - `anonymous` — a failed sign-in that matched no account at all. Somebody
 *     did it, and who is precisely what is unknown. Calling this "System" would
 *     be a lie on the row an admin is most likely reading closely, which is why
 *     the backend distinguishes them.
 *
 * `kind` carries that distinction explicitly rather than leaving the UI to infer
 * it from a null id or match on a display name the backend could reword.
 *
 * `initials` comes from the backend rather than being sliced off the name here,
 * the same rule every other admin list follows — a two-word Latin name and a
 * single-glyph script both need to render correctly.
 *
 * `roleLabel` is the job role ("Reviewer / Compliance"), null for a customer who
 * has no staff profile and for both actorless kinds.
 */
export type AdminAuditActor = {
  kind: 'account' | 'system' | 'anonymous';
  id: string | null;
  name: string;
  initials: string;
  roleLabel: string | null;
};

/*
 * One entry in the trail.
 *
 * `action` is the raw dotted verb ("auth.sign_in_failed") — the value the action
 * filter sends back. `actionLabel` is the backend's wording for it; the browser
 * never maps a verb to words, so a historical action the catalogue no longer
 * names still arrives readable.
 *
 * The metadata blob is NOT on the row. Its size is whatever the recording layer
 * chose to keep for that action, and a page of the trail was shipping fifty of
 * them to render fifty two-value preview lines. `metadataPreview` is that line,
 * built by the backend; the blob itself arrives with `AdminAuditEntry` when a
 * reader opens the row.
 *
 * `createdAt` is ISO-8601 UTC, converted to the viewer's zone only at render
 * (AGENTS.md, Dates).
 */
export type AdminAuditRow = {
  id: string;
  action: string;
  actionLabel: string;
  category: string;
  severity: AuditSeverity;
  actor: AdminAuditActor;
  entityType: string;
  entityId: string;
  metadataPreview: string | null;
  createdAt: string;
};

/*
 * One entry in full — what the expanded row reads, fetched per row.
 *
 * `metadata` is whatever the recording layer stored for this kind of event: a
 * status change, an amount in minor units, a set of permission keys. Its shape
 * varies per action by design, so it is `unknown` here and rendered generically
 * rather than typed per verb — a union of sixty shapes would have to be kept in
 * step with the backend by hand, which is exactly the drift the mirror rule
 * warns about. It never contains PII or card data (AGENTS.md, Security & PII).
 *
 * `ipAddress` is null for anything a job wrote: a background processor has no
 * request and therefore no caller address.
 */
export type AdminAuditEntry = AdminAuditRow & {
  metadata: unknown;
  ipAddress: string | null;
};

/*
 * One page of the trail plus the figures the footer prints. Cursor pagination is
 * the API convention (AGENTS.md), so `nextCursor` drives mobile's "Load more";
 * `page`/`totalPages` drive the numbered pager the wider links show.
 */
export type AdminAuditPage = {
  entries: AdminAuditRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

/*
 * The screen's KPI figures and filter chrome — one call, so the cards, the tabs,
 * and the action dropdown agree with each other and with the list.
 *
 * `entriesToday` and `failedSignIns` are both last-24-hours figures rather than
 * lifetime counts. A lifetime total only ever grows and says nothing; "37 failed
 * sign-ins today" against a normal handful is the signal an admin opens this
 * screen for.
 */
export type AdminAuditSummary = {
  totalEntries: number;
  entriesToday: number;
  failedSignIns: number;
  categories: AuditCategoryOption[];
  actions: AuditActionOption[];
};
