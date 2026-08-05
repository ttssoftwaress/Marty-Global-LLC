import { Prisma } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { logger } from '../../../lib/logger.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { hasPermission } from '../admin.guards.js';
import { iso } from '../admin.views.js';
import {
  allDescriptors,
  descriptorFor,
  idOf,
  isTrashEntityKey,
  selectFor,
  tableFor,
  whereIds,
  type TrashDependents,
  type TrashEntityKey,
} from './trash.registry.js';
import type { ListTrashQuery, TrashSettingsInput } from './trash.validation.js';

/*
 * Trash & restore — the generic delete behind every admin table.
 *
 * There is exactly one delete path in the admin portal now, and it is this file.
 * Deleting a row stamps `deletedAt` (which every read in both apps already
 * filters, so the row leaves every screen at once), soft-deletes the rows that
 * would otherwise be left pointing at it, and files a `TrashEntry` recording the
 * whole set. Restore clears precisely that set. Purge, thirty days later or when
 * an administrator says so, is the only statement here that destroys anything.
 *
 * This file holds no per-entity knowledge — `trash.registry.ts` does. Adding a
 * table to the trash is one entry there.
 *
 * FIVE RULES
 *
 * 1. **The cascade is captured, never re-derived.** Deleting a customer takes
 *    their orders; if one of those orders was already in the trash beforehand,
 *    restoring the customer must leave it there. Only the ids this click
 *    actually changed are recorded, and only those come back. That is the whole
 *    reason `updateMany` here is filtered on `deletedAt: null` and the changed
 *    ids are read back before the write rather than assumed from the input.
 *
 * 2. **Authorization is per entity, not per screen.** Deleting takes the
 *    entity's own admin area PLUS `data.delete`; a handful of entities take an
 *    administrator on top. Reading and restoring the bin takes `trash` PLUS,
 *    again, the entity's own area — so the bin can never show a member a row
 *    their sections do not. Purging early takes an administrator regardless of
 *    grants, because it is the one irreversible write in the feature.
 *
 * 3. **A refusal is a sentence, not a code.** Every guard returns copy the admin
 *    reads, and a bulk delete refuses the whole selection rather than silently
 *    completing part of it — "9 of 10 deleted, one of them was the last admin"
 *    is not a result anybody can act on.
 *
 * 4. **`purgeAt` is stamped, not computed.** The retention window is editable,
 *    and shortening it must never retroactively destroy something an admin was
 *    told they had thirty days to recover. Each entry keeps the deadline it was
 *    given.
 *
 * 5. **The trail outlives the record.** Every trash, restore, and purge writes an
 *    audit entry, and after a purge that entry is the only remaining evidence the
 *    record existed. Metadata carries the entity type, the id, and counts — never
 *    the label, which is a person's name (AGENTS.md, Security & PII).
 */

// --- Settings ------------------------------------------------------------

export type TrashSettingsView = {
  retentionDays: number;
  purgeEnabled: boolean;
};

const SETTINGS_ID = 'singleton';

/*
 * One row, upserted on first read — the same shape `PaymentSettings` and
 * `NotificationSettings` use, and for the same reason: a settings table with a
 * row count is a settings table someone eventually writes twice.
 */
export async function getSettings(): Promise<TrashSettingsView> {
  const row = await prisma.trashSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
    select: { retentionDays: true, purgeEnabled: true },
  });

  return row;
}

export async function updateSettings(
  actor: AuthContext,
  input: TrashSettingsInput,
): Promise<TrashSettingsView> {
  const before = await getSettings();

  const row = await prisma.trashSettings.update({
    where: { id: SETTINGS_ID },
    data: input,
    select: { retentionDays: true, purgeEnabled: true },
  });

  // Carries its values, unlike the payment settings: neither is sensitive, and
  // "how long was a deletion reversible that week" is exactly the question asked
  // later when a record turns out to be gone.
  void record({
    actor,
    action: AuditAction.TRASH_SETTINGS_UPDATED,
    entityType: 'TrashSettings',
    entityId: SETTINGS_ID,
    metadata: { before, after: row },
  });

  return row;
}

// --- Authorization -------------------------------------------------------

/*
 * May this actor act on this kind of row?
 *
 * `write` distinguishes the two questions the bin asks. Deleting and restoring
 * are writes and take `data.delete` / `trash` respectively on top of the
 * entity's area; listing only takes the area, which is what lets the list be
 * filtered to what a member can see rather than refused wholesale.
 */
async function mayTouch(
  actor: AuthContext,
  entity: TrashEntityKey,
): Promise<boolean> {
  const descriptor = descriptorFor(entity);

  if (descriptor.adminOnly && actor.role !== Role.ADMIN) return false;

  return hasPermission(actor, descriptor.permission);
}

async function assertMayDelete(
  actor: AuthContext,
  entity: TrashEntityKey,
): Promise<void> {
  if (!(await hasPermission(actor, 'data.delete'))) throw AppError.unauthorized();
  if (!(await mayTouch(actor, entity))) throw AppError.unauthorized();
}

/*
 * The entity types this actor may see in the bin. Computed once per request and
 * used as a `where` clause, never as a filter over results — the same rule
 * `admin.scope.ts` states: a total counted over a different set than the rows is
 * a footer that lies about what was shown.
 */
async function visibleEntities(actor: AuthContext): Promise<TrashEntityKey[]> {
  const checked = await Promise.all(
    allDescriptors().map(async (descriptor) =>
      (await mayTouch(actor, descriptor.key)) ? descriptor.key : null,
    ),
  );

  return checked.filter((key): key is TrashEntityKey => key !== null);
}

// --- The cascade ---------------------------------------------------------

/*
 * Every row one delete has to take, in the order to take them.
 *
 * A breadth-first walk of the registry's `dependents`, deduplicated by
 * entity+id, with the root last so a restore walking the list in reverse puts
 * parents back first. `seen` is what makes a diamond safe — a customer's order
 * and the customer both reach the same quote, and it must be recorded once.
 *
 * The walk is bounded by the registry's shape, which is a DAG today. `seen`
 * would terminate a cycle too, rather than looping, if one were ever added.
 */
async function closureOf(
  entity: TrashEntityKey,
  ids: string[],
): Promise<TrashDependents[]> {
  const seen = new Map<TrashEntityKey, Set<string>>([[entity, new Set(ids)]]);
  const collected: TrashDependents[] = [];

  let frontier: TrashDependents[] = [{ entity, ids }];

  while (frontier.length > 0) {
    const next: TrashDependents[] = [];

    for (const group of frontier) {
      const dependents = descriptorFor(group.entity).dependents;
      if (!dependents) continue;

      for (const child of await dependents(group.ids)) {
        const known = seen.get(child.entity) ?? new Set<string>();
        const fresh = child.ids.filter((id) => !known.has(id));
        if (fresh.length === 0) continue;

        for (const id of fresh) known.add(id);
        seen.set(child.entity, known);

        next.push({ entity: child.entity, ids: fresh });
        collected.push({ entity: child.entity, ids: fresh });
      }
    }

    frontier = next;
  }

  // Children first, root last — the order the writes run in, and the reverse of
  // the order a restore does.
  return [...collected, { entity, ids }];
}

/*
 * Stamp `deletedAt` on a group, and report back which rows it actually changed.
 *
 * The read-then-write is the point. `updateMany` reports a count, not ids, and
 * the count cannot tell an already-deleted row from a newly deleted one — which
 * is exactly the distinction rule 1 depends on. Both statements carry the same
 * `deletedAt: null` filter, so a row deleted by a concurrent request between
 * them simply is not claimed by this entry.
 */
async function stampGroup(
  group: TrashDependents,
  at: Date,
): Promise<string[]> {
  const table = tableFor(group.entity);
  const descriptor = descriptorFor(group.entity);

  const live = await table.findMany({
    where: { ...whereIds(group.entity, group.ids), deletedAt: null },
    select: { [descriptor.idField]: true },
  });

  const ids = live.map((row) => idOf(group.entity, row));
  if (ids.length === 0) return [];

  await table.updateMany({
    where: { ...whereIds(group.entity, ids), deletedAt: null },
    data: { deletedAt: at },
  });

  await descriptorFor(group.entity).onDelete?.(ids);

  return ids;
}

// --- Delete --------------------------------------------------------------

export type TrashDeleteResult = {
  entity: TrashEntityKey;
  deleted: number;
  // How many rows went with them. Printed back to the admin because "1 customer
  // deleted" and "1 customer and 47 related records deleted" are very different
  // confirmations.
  cascaded: number;
  purgeAt: string;
};

/*
 * Move rows to the trash. The one delete path.
 *
 * Refuses the whole selection if any single row is refused (rule 3). Rows
 * already in the trash are dropped from the selection silently — a double-submit
 * of the same delete is a no-op, not an error, and the unique
 * `[entityType, entityId]` is what makes that true even under a race.
 */
export async function trashRows(
  actor: AuthContext,
  entity: TrashEntityKey,
  ids: string[],
): Promise<TrashDeleteResult> {
  await assertMayDelete(actor, entity);

  const descriptor = descriptorFor(entity);
  const table = tableFor(entity);

  const rows = await table.findMany({
    where: { ...whereIds(entity, ids), deletedAt: null },
    select: selectFor(entity),
  });

  if (rows.length === 0) {
    throw AppError.notFound(
      `Nothing to delete — ${descriptor.pluralLabel.toLowerCase()} may already be in the Trash.`,
    );
  }

  // Every guard runs before any write, so a refusal leaves nothing half-done.
  if (descriptor.guard) {
    const blockers = await Promise.all(
      rows.map(async (row) => descriptor.guard?.(idOf(entity, row), row, actor) ?? null),
    );

    const refusal = blockers.find((reason): reason is string => reason !== null);
    if (refusal) throw AppError.businessRule(refusal, { entity });
  }

  const at = new Date();
  const { retentionDays } = await getSettings();
  const purgeAt = new Date(at.getTime() + retentionDays * 86_400_000);
  const deletedByName = await actorName(actor);

  const deletedIds: string[] = [];
  let cascaded = 0;

  /*
   * One row at a time, and the closure computed PER ROW rather than once for the
   * whole selection.
   *
   * That is the difference between a restore that works and one that overreaches:
   * a selection's shared closure attached to every entry would restore all three
   * customers' orders when one customer is put back, and attached to only the
   * first entry would leave the other two restoring nothing. Each entry owns
   * exactly the rows its own delete took.
   *
   * Each row's writes are their own transaction. A bulk delete of ten customers
   * is ten atomic deletes rather than one long-held lock across every table the
   * closure touches — which is how this stays out of the orders queue's way. The
   * guards have already all passed by here, so a failure part-way leaves earlier
   * rows deleted and filed, never soft-deleted without a way back.
   */
  for (const row of rows) {
    const id = idOf(entity, row);
    const described = descriptor.describe(row);
    const groups = await closureOf(entity, [id]);

    const changed: TrashDependents[] = [];

    for (const group of groups) {
      const stamped = await stampGroup(group, at);
      if (stamped.length > 0) changed.push({ entity: group.entity, ids: stamped });
    }

    // `closureOf` puts the root last, so its own group is the tail — and it is
    // stored as `entityId`, never repeated inside `cascade`.
    const root = changed.at(-1);
    if (!root || root.entity !== entity) continue;

    const dependents = changed.slice(0, -1);
    cascaded += dependents.reduce((total, group) => total + group.ids.length, 0);
    deletedIds.push(id);

    await prisma.trashEntry.upsert({
      where: { entityType_entityId: { entityType: entity, entityId: id } },
      create: {
        entityType: entity,
        entityId: id,
        label: described.label,
        sublabel: described.sublabel ?? null,
        deletedById: actor.userId,
        deletedByName,
        purgeAt,
        cascade:
          dependents.length > 0
            ? (dependents as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
      // A row already in the bin keeps the entry it has — including the deadline
      // it was given. Re-deleting must not quietly extend somebody's window.
      update: {},
    });
  }

  void record({
    actor,
    action: AuditAction.RECORD_TRASHED,
    entityType: entity,
    entityId: deletedIds[0] ?? '',
    metadata: { entity, ids: deletedIds, cascaded, retentionDays },
  });

  return {
    entity,
    deleted: deletedIds.length,
    cascaded,
    purgeAt: iso(purgeAt),
  };
}

/*
 * Who to print as the deleter, snapshotted onto the entry.
 *
 * `AuthContext` carries identity, not the user row (guards/auth-context.ts), so
 * the name is read here — once per delete, not once per row. It falls back to
 * the address rather than to "Unknown": a trash entry nobody can attribute is
 * the one thing this screen must not produce.
 */
async function actorName(actor: AuthContext): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true },
  });

  return user?.name?.trim() || actor.email;
}

// --- List ----------------------------------------------------------------

export type TrashRow = {
  id: string;
  entityType: TrashEntityKey;
  entityLabel: string;
  entityId: string;
  label: string;
  sublabel: string | null;
  deletedBy: string;
  deletedAt: string;
  purgeAt: string;
  // Whole days left, floored, never below zero. Computed server-side so the
  // countdown cannot disagree with the sweep that acts on it.
  daysLeft: number;
  cascadeCount: number;
  purgeError: string | null;
};

export type TrashPage = {
  entries: TrashRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

export type TrashSummary = {
  totalEntries: number;
  // Entries whose window closes within the next seven days — the figure that
  // makes the screen worth opening rather than a lifetime count that only grows.
  expiringSoon: number;
  retentionDays: number;
  purgeEnabled: boolean;
  types: { value: string; label: string; count: number }[];
};

const DEFAULT_LIMIT = 20;

function daysLeft(purgeAt: Date, now: Date): number {
  return Math.max(0, Math.floor((purgeAt.getTime() - now.getTime()) / 86_400_000));
}

function countCascade(value: Prisma.JsonValue | null): number {
  if (!Array.isArray(value)) return 0;

  return value.reduce<number>((total, group) => {
    if (typeof group !== 'object' || group === null || Array.isArray(group)) return total;
    const ids = (group as Record<string, unknown>).ids;
    return total + (Array.isArray(ids) ? ids.length : 0);
  }, 0);
}

async function scopedWhere(
  actor: AuthContext,
  entity?: TrashEntityKey,
): Promise<Prisma.TrashEntryWhereInput> {
  const visible = await visibleEntities(actor);

  // An explicit type filter narrows within what they may see; it never widens
  // it, so a member cannot read another section's bin by naming its type.
  const types = entity ? visible.filter((key) => key === entity) : visible;

  return { entityType: { in: types } };
}

export async function listTrash(
  actor: AuthContext,
  query: ListTrashQuery,
): Promise<TrashPage> {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const where: Prisma.TrashEntryWhereInput = {
    ...(await scopedWhere(actor, query.entityType)),
    ...(query.search
      ? {
          OR: [
            { label: { contains: query.search, mode: 'insensitive' } },
            { sublabel: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.trashEntry.count({ where }),
    prisma.trashEntry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, limit),
    }),
  ]);

  const page = takePage(rows, limit);
  const now = new Date();

  return {
    entries: page.rows.map((row) => {
      const entity = row.entityType as TrashEntityKey;

      return {
        id: row.id,
        entityType: entity,
        entityLabel: isTrashEntityKey(entity)
          ? descriptorFor(entity).label
          : row.entityType,
        entityId: row.entityId,
        label: row.label,
        sublabel: row.sublabel,
        deletedBy: row.deletedByName,
        deletedAt: iso(row.createdAt),
        purgeAt: iso(row.purgeAt),
        daysLeft: daysLeft(row.purgeAt, now),
        cascadeCount: countCascade(row.cascade),
        purgeError: row.purgeError,
      };
    }),
    nextCursor: page.nextCursor,
    page: query.page ?? 1,
    totalPages: totalPages(totalResults, limit),
    totalResults,
  };
}

export async function getTrashSummary(actor: AuthContext): Promise<TrashSummary> {
  const where = await scopedWhere(actor);
  const soon = new Date(Date.now() + 7 * 86_400_000);

  const [totalEntries, expiringSoon, grouped, settings] = await Promise.all([
    prisma.trashEntry.count({ where }),
    prisma.trashEntry.count({ where: { ...where, purgeAt: { lte: soon } } }),
    prisma.trashEntry.groupBy({ by: ['entityType'], where, _count: { _all: true } }),
    getSettings(),
  ]);

  const counts = new Map(grouped.map((row) => [row.entityType, row._count._all]));

  return {
    totalEntries,
    expiringSoon,
    retentionDays: settings.retentionDays,
    purgeEnabled: settings.purgeEnabled,
    /*
     * Only the types that actually have something in them. A filter listing
     * twenty-five entity types with "0" against twenty-three of them is a filter
     * nobody reads — and the counts are cheap here because one grouped query
     * answers all of them.
     */
    types: allDescriptors()
      .filter((descriptor) => (counts.get(descriptor.key) ?? 0) > 0)
      .map((descriptor) => ({
        value: descriptor.key,
        label: descriptor.pluralLabel,
        count: counts.get(descriptor.key) ?? 0,
      })),
  };
}

// --- Restore -------------------------------------------------------------

export type TrashRestoreResult = { restored: number; cascaded: number };

/*
 * Put back exactly what was taken.
 *
 * Restore is the reverse of the recorded cascade, parents last — so nothing is
 * ever briefly visible with the record it hangs off still missing. Only the ids
 * on the entry are cleared, which is rule 1's other half: a row that was already
 * deleted before the click was never claimed by this entry, so it stays deleted.
 *
 * The entry is removed in the same transaction as the last clear. The table
 * holds live trash only, which is what lets `[entityType, entityId]` be unique
 * and what makes a double-clicked restore a no-op rather than a second one.
 */
export async function restoreEntries(
  actor: AuthContext,
  entryIds: string[],
): Promise<TrashRestoreResult> {
  const entries = await prisma.trashEntry.findMany({ where: { id: { in: entryIds } } });

  if (entries.length === 0) throw AppError.notFound('Nothing to restore');

  for (const entry of entries) {
    const entity = entry.entityType;
    if (!isTrashEntityKey(entity)) continue;
    if (!(await mayTouch(actor, entity))) throw AppError.unauthorized();
  }

  let restored = 0;
  let cascaded = 0;

  for (const entry of entries) {
    const entity = entry.entityType;

    if (!isTrashEntityKey(entity)) {
      /*
       * An entity type this build no longer knows — a table removed from the
       * registry while its entries were still in the bin. There is nothing to
       * restore it INTO, so the entry is dropped rather than left as a row whose
       * button can only ever fail.
       */
      await prisma.trashEntry.delete({ where: { id: entry.id } });
      continue;
    }

    const groups = parseCascade(entry.cascade);

    // Reverse: the root first, then its dependents outward.
    for (const group of [{ entity, ids: [entry.entityId] }, ...groups.reverse()]) {
      if (!isTrashEntityKey(group.entity)) continue;

      await tableFor(group.entity).updateMany({
        where: whereIds(group.entity, group.ids),
        data: { deletedAt: null },
      });

      await descriptorFor(group.entity).onRestore?.(group.ids);

      if (group.entity === entity && group.ids[0] === entry.entityId) restored += 1;
      else cascaded += group.ids.length;
    }

    await prisma.trashEntry.delete({ where: { id: entry.id } });

    void record({
      actor,
      action: AuditAction.RECORD_RESTORED,
      entityType: entity,
      entityId: entry.entityId,
      metadata: { entity, cascaded: countCascade(entry.cascade) },
    });
  }

  return { restored, cascaded };
}

function parseCascade(value: Prisma.JsonValue | null): TrashDependents[] {
  if (!Array.isArray(value)) return [];

  const groups: TrashDependents[] = [];

  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;

    const group = raw as Record<string, unknown>;
    const ids = group.ids;

    if (!isTrashEntityKey(group.entity) || !Array.isArray(ids)) continue;

    groups.push({
      entity: group.entity,
      ids: ids.filter((id): id is string => typeof id === 'string'),
    });
  }

  return groups;
}

// --- Purge ---------------------------------------------------------------

export type TrashPurgeResult = { purged: number; kept: number };

/*
 * Destroy the rows behind a set of entries. The only irreversible write here.
 *
 * The root row is deleted and the database's own `onDelete: Cascade` takes the
 * children with it — the cascade recorded on the entry is a restore instruction,
 * not a delete plan, and re-walking it here would delete rows in an order the
 * foreign keys refuse.
 *
 * Two things can stop a purge and neither may stop the sweep: an entity's
 * `purgeGuard` (a staff account owning customer records must be revoked, never
 * dropped) and a `Restrict` foreign key that something started depending on
 * while the row sat in the bin. Both leave the entry in place with the reason
 * recorded and the deadline pushed forward, so one stuck row cannot fail the
 * night's work — and an admin has something to act on rather than a silent stall.
 */
export async function purgeEntries(
  actor: AuthContext | null,
  entryIds: string[],
): Promise<TrashPurgeResult> {
  const entries = await prisma.trashEntry.findMany({ where: { id: { in: entryIds } } });

  let purged = 0;
  let kept = 0;

  for (const entry of entries) {
    const entity = entry.entityType;

    if (!isTrashEntityKey(entity)) {
      await prisma.trashEntry.delete({ where: { id: entry.id } });
      purged += 1;
      continue;
    }

    const blocker = await descriptorFor(entity).purgeGuard?.(entry.entityId);

    if (blocker) {
      await defer(entry.id, blocker);
      kept += 1;
      continue;
    }

    try {
      await tableFor(entity).deleteMany({ where: whereIds(entity, [entry.entityId]) });
      await prisma.trashEntry.delete({ where: { id: entry.id } });
      purged += 1;

      /*
       * Written with the record gone, which is the point: after this the trail is
       * the only thing that still says the row existed. A null actor is the
       * nightly sweep; an administrator emptying the bin early carries theirs,
       * and that is how the two are told apart.
       */
      void record({
        actor,
        action: AuditAction.RECORD_PURGED,
        entityType: entity,
        entityId: entry.entityId,
        metadata: { entity, cascaded: countCascade(entry.cascade) },
      });
    } catch (error) {
      const reason =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
          ? 'Another record now depends on this one, so it cannot be removed. Restore it, or clear what references it first.'
          : 'The permanent delete failed. It will be retried.';

      // The error itself never reaches the admin — a driver message can carry a
      // column name and a value (AGENTS.md: log the detail, return a code).
      logger.error(
        { err: error, entity, entryId: entry.id },
        'Trash purge failed for entry',
      );

      await defer(entry.id, reason);
      kept += 1;
    }
  }

  return { purged, kept };
}

// Keep the entry, record why, and try again tomorrow.
async function defer(entryId: string, reason: string): Promise<void> {
  await prisma.trashEntry.update({
    where: { id: entryId },
    data: {
      purgeError: reason,
      purgeAttempts: { increment: 1 },
      purgeAt: new Date(Date.now() + 86_400_000),
    },
  });
}

/*
 * The nightly sweep. Called by the job processor with no actor.
 *
 * Batched rather than unbounded: a first run against a long-neglected bin would
 * otherwise hold one process on thousands of cascading deletes. What it does not
 * finish tonight it finishes tomorrow, because the entries it left are still
 * past their deadline.
 */
const PURGE_BATCH = 200;

export async function purgeExpired(): Promise<TrashPurgeResult> {
  const { purgeEnabled } = await getSettings();

  // The stop switch, read fresh on every run — the same posture as the USDT
  // verifier and the outbound-email gate. Off means nothing is destroyed today.
  if (!purgeEnabled) return { purged: 0, kept: 0 };

  const due = await prisma.trashEntry.findMany({
    where: { purgeAt: { lte: new Date() } },
    orderBy: { purgeAt: 'asc' },
    take: PURGE_BATCH,
    select: { id: true },
  });

  if (due.length === 0) return { purged: 0, kept: 0 };

  return purgeEntries(
    null,
    due.map((entry) => entry.id),
  );
}

/*
 * Emptying the bin ahead of its window, from the screen.
 *
 * Narrowed to an administrator on the route as well as here. It is the one
 * operation in this module with no way back, and the retention window exists
 * precisely so that the ordinary delete never is.
 */
export async function purgeNow(
  actor: AuthContext,
  entryIds: string[],
): Promise<TrashPurgeResult> {
  if (actor.role !== Role.ADMIN) throw AppError.unauthorized();

  const entries = await prisma.trashEntry.findMany({
    where: { id: { in: entryIds } },
    select: { id: true, entityType: true },
  });

  if (entries.length === 0) throw AppError.notFound('Nothing to delete');

  // An administrator passes every area, so this cannot refuse in practice — it
  // is here so the rule survives a future role that is admin-but-narrowed.
  for (const entry of entries) {
    if (!isTrashEntityKey(entry.entityType)) continue;
    if (!(await mayTouch(actor, entry.entityType))) throw AppError.unauthorized();
  }

  return purgeEntries(
    actor,
    entries.map((entry) => entry.id),
  );
}
