-- Trash & restore — a deletion an admin can take back.
--
-- WHY THIS EXISTS.
--
--   Most tables in this schema already carry `deletedAt` and every read already
--   filters it, so a soft delete was always possible. What was missing was the
--   other half: nothing recorded WHICH rows one click removed, so nothing could
--   put them back. A mis-click on a customer row was recoverable only by hand,
--   through a database edit, which AGENTS.md forbids.
--
--   `trash_entry` is that record. It names the deleted row, snapshots what to
--   print for it, stamps who removed it and when the retention window closes,
--   and carries `cascade` — the exact ids of every other row the same click had
--   to soft-delete so nothing was left pointing at a record that had vanished.
--
--   The ids are captured at delete time rather than re-derived at restore time
--   on purpose. Deleting a customer takes their orders with it; if one of those
--   orders was already in the trash beforehand, restoring the customer must
--   leave it there. A closure recomputed later cannot tell those two apart.
--
-- SEVEN NEW `deletedAt` COLUMNS.
--
--   Locations, mail carriers, both field registries, staff roles, the mail log,
--   and the unmatched-transfer queue are all admin tables, and all of them
--   deleted by dropping the row. Their guards were sound — each refuses while
--   anything references the row — but a guard is not an undo, and these are
--   configuration tables where a wrong delete is exactly the kind of mistake
--   nobody notices until a form stops rendering.
--
--   The guards are unchanged. Only what a successful delete DOES changes.
--
--   Consequence worth stating: `region.code`, `mail_carrier.code`,
--   `field_definition.key`, `result_field_definition.key` and `staff_role.key`
--   stay unique, so a row sitting in the trash keeps its code. Creating a new
--   row under that code is refused with a message naming the trash instead of a
--   bare unique-constraint error — reviving the trashed row silently would hand
--   back old data wearing new labels.
--
-- WHAT IS DELIBERATELY ABSENT.
--
--   `audit_log`. The trail is the evidence a deletion happened; a delete button
--   over it erases its own record. The audit module has no write path at all,
--   and this does not add one.
--
-- RETENTION IS DATA.
--
--   `trash_settings.retentionDays` (30) and `purgeEnabled` (true), one row,
--   upserted. The same argument as payment and notification settings: AGENTS.md
--   is explicit that filings and payments carry regulatory retention, so how
--   long a deletion stays reversible — and whether the sweep destroys anything
--   at all today — must be changeable without a redeploy. `purgeAt` is stored
--   per entry rather than computed, so shortening the window never retroactively
--   destroys something an admin was told they had 30 days to recover.

ALTER TABLE "region" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "mail_carrier" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "field_definition" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "result_field_definition" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "staff_role" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "mail_action_log" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "unmatched_transfer" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE TABLE "trash_entry" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sublabel" TEXT,
    "deletedById" TEXT,
    "deletedByName" TEXT NOT NULL,
    "purgeAt" TIMESTAMPTZ(3) NOT NULL,
    "cascade" JSONB,
    "purgeError" TEXT,
    "purgeAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trash_entry_pkey" PRIMARY KEY ("id")
);

-- One live entry per record: the row cannot be trashed twice, and a restore
-- cannot run twice against the same entry.
CREATE UNIQUE INDEX "trash_entry_entityType_entityId_key"
    ON "trash_entry" ("entityType", "entityId");

-- The screen's default view — newest deletion first, with the id tiebreak the
-- cursor needs when one click files several entries in the same millisecond.
CREATE INDEX "trash_entry_createdAt_id_idx"
    ON "trash_entry" ("createdAt" DESC, "id" DESC);

CREATE INDEX "trash_entry_entityType_createdAt_idx"
    ON "trash_entry" ("entityType", "createdAt" DESC);

-- The nightly sweep's scan: everything past its deadline.
CREATE INDEX "trash_entry_purgeAt_idx" ON "trash_entry" ("purgeAt");

CREATE TABLE "trash_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "purgeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trash_settings_pkey" PRIMARY KEY ("id")
);
