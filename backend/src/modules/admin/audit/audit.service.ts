import type { Prisma } from '@prisma/client';

import { AppError } from '../../../lib/app-error.js';
import { toInitials } from '../../../lib/initials.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import {
  AUDIT_CATEGORIES,
  actionsInCategory,
  auditActionOptions,
  describe,
  isAuditCategory,
  type AuditSeverity,
} from '../../audit/audit.catalog.js';
import { iso } from '../admin.views.js';
import type { ListAuditQuery } from './audit.validation.js';

/*
 * The audit log's read half — the admin-facing viewer.
 *
 * Until this module existed the `AuditLog` table was write-only: every admin
 * write recorded into it and nothing ever read it back, which makes a trail
 * evidence nobody can examine. This is the one layer that queries it.
 *
 * Read-only by design, and there is no write path here at all. Rows are written
 * by `modules/audit/audit.service.ts` and by nothing else; an audit trail that
 * an endpoint can edit or delete is not a trail, so this module offers no PATCH,
 * no DELETE, and no bulk action. The same reasoning is why the table has no
 * `deletedAt` — an audit row is never retired.
 *
 * Three things the queries here have to get right:
 *
 *   - The filters are `where` clauses, never post-filtering. Same rule as
 *     `admin.scope.ts`: a total computed over a different set than the rows is a
 *     footer that lies about what was shown.
 *   - Actor names are resolved in one batched lookup, not per row. The table
 *     stores `actorId` only — deliberately, since a name copied onto the row at
 *     write time would freeze at whatever it was that day — so the viewer joins
 *     them back on read.
 *   - Metadata is passed through untouched. It is written PII-free by the
 *     recording layer (that file's rule 2), and re-shaping it here would be a
 *     second place deciding what an entry means.
 */

// --- Summary -------------------------------------------------------------

export type AdminAuditSummary = {
  totalEntries: number;
  entriesToday: number;
  failedSignIns: number;
  categories: { value: string; label: string; count?: number }[];
  actions: { value: string; label: string; category: string }[];
};

/*
 * The three KPI figures and the filter vocabularies.
 *
 * `failedSignIns` is scoped to the last 24 hours rather than all time, and that
 * is the figure worth printing: the lifetime count only ever grows and says
 * nothing, while "37 failed sign-ins today" against a normal handful is the
 * signal an admin opens this screen for.
 */
export async function getSummary(): Promise<AdminAuditSummary> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalEntries, entriesToday, failedSignIns] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    prisma.auditLog.count({
      where: { action: 'auth.sign_in_failed', createdAt: { gte: since } },
    }),
  ]);

  return {
    totalEntries,
    entriesToday,
    failedSignIns,
    // No per-category counts: each would be its own `count` over the same large
    // table on every page load, and the tabs read fine without them. The list's
    // own `totalResults` gives the number once a category is picked.
    categories: [
      { value: 'all', label: 'All activity' },
      ...AUDIT_CATEGORIES.map((entry) => ({ value: entry.key, label: entry.label })),
    ],
    actions: auditActionOptions(),
  };
}

// --- List ----------------------------------------------------------------

/*
 * `kind` rather than inferring from a null id, because there are two different
 * actorless rows and the browser must not have to tell them apart by matching on
 * a display name the backend could reword.
 */
export type AdminAuditActor = {
  kind: 'account' | 'system' | 'anonymous';
  id: string | null;
  name: string;
  initials: string;
  roleLabel: string | null;
};

/*
 * The row.
 *
 * `metadata` is deliberately absent. It is the one column here whose size is
 * unbounded and unknowable — it is whatever the recording layer chose to keep
 * for that action — and a page of the trail was shipping every entry's full
 * blob to render a two-value preview line. The preview is computed here
 * instead, and the blob is served by `getEntry` when a reader opens the row.
 * The caller's IP goes with it for the same reason: it is only ever read while
 * looking closely at one entry.
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
  /** The first two metadata values, for the collapsed row. */
  metadataPreview: string | null;
  createdAt: string;
};

/** The expanded row: everything the list left out. */
export type AdminAuditEntry = AdminAuditRow & {
  metadata: Prisma.JsonValue | null;
  ipAddress: string | null;
};

export type AdminAuditPage = {
  entries: AdminAuditRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

/*
 * The system actor. A job processor — the USDT poller crediting a payment, the
 * reminder sweep — writes with no actor, which the schema allows and which is
 * not a missing value: nobody did it, the system did.
 *
 * Printed rather than left blank so a row with no actor is unambiguous. A blank
 * cell reads as data the screen failed to load.
 */
const SYSTEM_ACTOR: AdminAuditActor = {
  kind: 'system',
  id: null,
  name: 'System',
  initials: 'SY',
  roleLabel: null,
};

/*
 * The other actorless row, and it must not read as the one above.
 *
 * A failed sign-in that matched no account has no actor either — but "System"
 * would be a lie on precisely the row an admin is most likely to be reading
 * closely. Nobody signed in; an unidentified caller tried to. The auth hook
 * marks these with the `unknown` entity id (it has no user row to point at), so
 * that is what distinguishes them from a job's write.
 */
const UNKNOWN_ENTITY_ID = 'unknown';

const ANONYMOUS_ACTOR: AdminAuditActor = {
  kind: 'anonymous',
  id: null,
  name: 'Unidentified caller',
  initials: '?',
  roleLabel: null,
};

/*
 * Names for a page of rows, in one query.
 *
 * A deleted staff member still appears in the trail — that is the point of soft
 * deletion, and the reason this lookup does not filter on `deletedAt`. Someone
 * who was removed last month is exactly who an investigation is looking for, so
 * their row keeps their name rather than becoming anonymous when they left.
 */
async function resolveActors(
  actorIds: readonly string[],
): Promise<Map<string, AdminAuditActor>> {
  if (actorIds.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: [...actorIds] } },
    select: {
      id: true,
      name: true,
      staffProfile: { select: { role: { select: { label: true } } } },
    },
  });

  return new Map(
    users.map((user) => [
      user.id,
      {
        kind: 'account',
        id: user.id,
        name: user.name,
        initials: toInitials(user.name),
        // The job role, which is what the team screen prints. A customer has no
        // staff profile, so theirs is null and the row shows no role chip.
        roleLabel: user.staffProfile?.role.label ?? null,
      },
    ]),
  );
}

/*
 * An actor id that resolves to no user row. Happens when a hard delete removed
 * the account (only a half-provisioned staff login is ever hard-deleted — see
 * `team.service.ts`), and for the `unknown` id the auth hook writes when a
 * sign-in attempt matched no account at all.
 *
 * The id is still shown. It is the only handle on who acted, and dropping it
 * would leave the row less informative than the raw table.
 */
function unresolvedActor(actorId: string): AdminAuditActor {
  return {
    kind: 'account',
    id: actorId,
    name: 'Unknown account',
    initials: '?',
    roleLabel: null,
  };
}

/*
 * The row's one-line summary of its metadata.
 *
 * Computed here rather than in the browser because the browser no longer
 * receives the blob it would compute it from. Two values is what fits beside a
 * severity chip at the tablet width; the rest is in the expanded panel, which
 * renders the raw object generically and needs no help from this.
 *
 * Deliberately dumb about shape: keys are printed as written (the recording
 * layer writes readable camelCase) and anything that is not a scalar is dropped
 * rather than stringified — a nested object reads as noise on one line, and the
 * panel shows it properly a click away.
 */
const PREVIEW_VALUES = 2;
const PREVIEW_VALUE_LENGTH = 40;

function previewValue(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string' || value.length === 0) return null;

  return value.length > PREVIEW_VALUE_LENGTH
    ? `${value.slice(0, PREVIEW_VALUE_LENGTH)}…`
    : value;
}

function metadataPreview(metadata: Prisma.JsonValue | null): string | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return null;
  }

  const parts: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    const printable = previewValue(value);
    if (printable === null) continue;

    parts.push(`${key}: ${printable}`);
    if (parts.length === PREVIEW_VALUES) break;
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function buildWhere(query: ListAuditQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  /*
   * Action beats category when both arrive. A single verb is strictly narrower
   * than the group it belongs to, so intersecting them could only ever produce
   * the action's own rows or an empty set — and an empty set would be the case
   * where the client sent a mismatched pair, which should read as "you asked for
   * this action" rather than as "there is nothing here".
   */
  if (query.action) {
    where.action = query.action;
  } else if (query.category !== 'all' && isAuditCategory(query.category)) {
    const actions = actionsInCategory(query.category);

    /*
     * Catalogued verbs OR anything carrying the category's own prefix. The
     * second clause is what keeps a historical action — one written before the
     * catalogue named it — visible under the category its row displays as. A
     * filter that hides rows the unfiltered list shows in that same group would
     * be worse than no filter.
     */
    where.OR = [
      ...(actions.length > 0 ? [{ action: { in: actions } }] : []),
      { action: { startsWith: `${query.category}.` } },
    ];
  }

  if (query.actorId) where.actorId = query.actorId;

  // Both or neither — the schema's index is on the pair, and an entity id alone
  // is ambiguous across tables. The validation layer enforces the pairing.
  if (query.entityType && query.entityId) {
    where.entityType = query.entityType;
    where.entityId = query.entityId;
  }

  // Over the action verb only. Metadata is deliberately excluded — see the
  // validation file for why.
  if (query.search) {
    where.action = { contains: query.search, mode: 'insensitive' };
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      // Exclusive upper bound: the frontend sends a day boundary, and a half-open
      // interval is the only shape that neither drops nor double-counts midnight.
      ...(query.to ? { lt: new Date(query.to) } : {}),
    };
  }

  return where;
}

export async function listAudit(query: ListAuditQuery): Promise<AdminAuditPage> {
  const where = buildWhere(query);

  const [totalResults, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      // Newest first — an audit log is read from the present backwards. The id
      // tiebreak keeps the cursor stable when two rows share a timestamp, which
      // is routine here: one request can write several entries.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  const actorIds = [
    ...new Set(page.rows.flatMap((row) => (row.actorId ? [row.actorId] : []))),
  ];
  const actors = await resolveActors(actorIds);

  return {
    entries: page.rows.map((row) => {
      const described = describe(row.action);

      return {
        id: row.id,
        action: row.action,
        actionLabel: described.label,
        category: described.category,
        severity: described.severity,
        actor: row.actorId
          ? (actors.get(row.actorId) ?? unresolvedActor(row.actorId))
          : row.entityId === UNKNOWN_ENTITY_ID
            ? ANONYMOUS_ACTOR
            : SYSTEM_ACTOR,
        entityType: row.entityType,
        entityId: row.entityId,
        metadataPreview: metadataPreview(row.metadata),
        createdAt: iso(row.createdAt),
      };
    }),
    nextCursor: page.nextCursor,
    page: query.cursor ? 0 : 1,
    totalPages: totalPages(totalResults, query.limit),
    totalResults,
  };
}

// --- One entry -----------------------------------------------------------

/*
 * The expanded row: the same entry, plus the two fields the list withholds.
 *
 * Fetched per row rather than shipped with the page, which is what lets the
 * list stay a fixed size regardless of what any single action recorded. Read
 * only, like everything else in this module.
 *
 * No `AppError.notFound` guard beyond the lookup: an audit id either exists or
 * it does not, and there is no scope to check — holding the `audit` area means
 * reading all of it (see the router's note on why there is no `audit.all`).
 */
export async function getEntry(id: string): Promise<AdminAuditEntry> {
  const row = await prisma.auditLog.findUnique({ where: { id } });
  if (!row) throw AppError.notFound('Audit entry not found');

  const described = describe(row.action);
  const actors = await resolveActors(row.actorId ? [row.actorId] : []);

  return {
    id: row.id,
    action: row.action,
    actionLabel: described.label,
    category: described.category,
    severity: described.severity,
    actor: row.actorId
      ? (actors.get(row.actorId) ?? unresolvedActor(row.actorId))
      : row.entityId === UNKNOWN_ENTITY_ID
        ? ANONYMOUS_ACTOR
        : SYSTEM_ACTOR,
    entityType: row.entityType,
    entityId: row.entityId,
    metadataPreview: metadataPreview(row.metadata),
    metadata: row.metadata,
    ipAddress: row.ipAddress,
    createdAt: iso(row.createdAt),
  };
}
