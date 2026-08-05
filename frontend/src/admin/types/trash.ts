/*
 * Trash & restore — local mirror of the API shapes (AGENTS.md, two-apps sync
 * rule). The backend is the source of truth; source is
 * `backend/src/modules/admin/trash/`.
 *
 * The entity vocabulary below is the one thing here that must stay in step with
 * the backend by hand, and it is deliberately narrow: a `TrashEntityKey` is what
 * a table sends when it deletes rows, so a key this app does not know is a table
 * that has no delete button yet — not a break. The trash list itself never
 * depends on it, because every entry arrives carrying its own `entityLabel`
 * resolved server-side, exactly as the audit log's action labels do.
 */

export type TrashEntityKey =
  | 'order'
  | 'order-document'
  | 'customer'
  | 'quote'
  | 'payment'
  | 'unmatched-transfer'
  | 'bank-account'
  | 'service'
  | 'pricing-tier'
  | 'request-type'
  | 'field'
  | 'result-field'
  | 'record'
  | 'service-request'
  | 'mail-room'
  | 'mail-item'
  | 'mail-request'
  | 'mail-log'
  | 'carrier'
  | 'location'
  | 'conversation'
  | 'message'
  | 'staff-member'
  | 'staff-role'
  | 'lead';

/*
 * One deleted record, as the Trash screen prints it.
 *
 * `label` and `sublabel` are snapshots taken at delete time, not a live join —
 * after a permanent delete there is nothing left to join to, and a list that
 * cannot name what it is about to destroy is not a confirmation screen.
 *
 * `daysLeft` is computed server-side rather than derived here from `purgeAt`.
 * The countdown and the sweep that acts on it must not be able to disagree, and
 * a browser clock is the one input this app cannot trust for that.
 */
export type TrashEntry = {
  id: string;
  entityType: TrashEntityKey;
  // "Order", "Mail room" — the singular label, resolved by the backend so that
  // adding a table to the Trash needs no frontend deploy to read correctly.
  entityLabel: string;
  entityId: string;
  label: string;
  sublabel: string | null;
  deletedBy: string;
  deletedAt: string;
  purgeAt: string;
  daysLeft: number;
  /*
   * How many other rows went with this one. Printed because "1 customer" and
   * "1 customer and 47 related records" are very different things to restore or
   * destroy, and the number is the only warning an admin gets before either.
   */
  cascadeCount: number;
  /*
   * Why the last permanent-delete attempt was refused, when one was. Two
   * causes: a rule that says the row must be kept (a staff account owning
   * customer records is revoked, never dropped), or something that started
   * referencing it while it sat here. Either way the entry stays and the
   * deadline moves, so this is information rather than an error state.
   */
  purgeError: string | null;
};

export type TrashPage = {
  entries: TrashEntry[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

// A type filter option. Only types that actually have something in them are
// sent — a filter listing twenty-five kinds with zero against most of them is a
// filter nobody reads.
export type TrashTypeOption = {
  value: string;
  label: string;
  count: number;
};

export type TrashSummary = {
  totalEntries: number;
  // Entries whose window closes within the next seven days — the figure that
  // makes this screen worth opening, unlike a lifetime total that only grows.
  expiringSoon: number;
  retentionDays: number;
  purgeEnabled: boolean;
  types: TrashTypeOption[];
};

export type TrashSettings = {
  retentionDays: number;
  purgeEnabled: boolean;
};

// What a delete reports back. `cascaded` is what the confirmation toast prints,
// and the reason a bulk delete is not silent about its reach.
export type TrashDeleteResult = {
  entityType: TrashEntityKey;
  deleted: number;
  cascaded: number;
  purgeAt: string;
};

export type TrashRestoreResult = { restored: number; cascaded: number };

// `kept` is not a failure: it counts the rows a rule said must stay. They are
// still in the bin, with the reason on the entry.
export type TrashPurgeResult = { purged: number; kept: number };

export const ALL_TRASH_TYPES = 'all';
