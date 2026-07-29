-- Indexes for the admin audit log viewer.
--
-- The table already carried `(entityType, entityId)` and `(actorId, createdAt)`,
-- which answer "what happened to this record" and "what did this person do".
-- Neither answers what the viewer actually asks — "what happened, newest
-- first" — so every query behind that screen was a sequential scan plus a sort
-- over the whole table.
--
-- Harmless at a few thousand rows, but `audit_log` is the one table in the
-- schema that only ever grows: nothing deletes from it, by design.
--
-- The sort direction is part of both indexes. The list orders by
-- `createdAt DESC, id DESC`, and the id tiebreak matters: one request routinely
-- writes several entries in the same millisecond, so without it the cursor could
-- skip or repeat a row across pages.

CREATE INDEX "audit_log_createdAt_id_idx"
  ON "audit_log" ("createdAt" DESC, "id" DESC);

-- The category and action filters, and the failed-sign-in KPI. All three filter
-- on `action` and then sort by time; an index on `action` alone would still
-- leave the sort to a heap scan on the largest category.
CREATE INDEX "audit_log_action_createdAt_idx"
  ON "audit_log" ("action", "createdAt" DESC);
