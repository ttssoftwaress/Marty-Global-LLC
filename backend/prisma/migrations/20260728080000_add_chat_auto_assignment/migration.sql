-- Automatic chat assignment.
--
-- Incoming support threads are now routed to an agent the moment they are
-- created, instead of landing in an unclaimed pool
-- (modules/support/support.assignment.ts). Two things follow from that:
--
--   1. The router needs to know when each agent last received a chat, so equal
--      load can be broken fairly rather than alphabetically.
--   2. A support agent's inbox is now always "the threads assigned to me",
--      which is a different access path than the old shared queue.
--
-- The permission that lets an admin move a thread between agents
-- (`support.assign`) needs no migration: it lives in the StaffProfile
-- `permissions` string array, like every other grant.

-- --- Assignment timestamp ---------------------------------------------------
-- When the thread was routed to its current assignee. Left NULL on existing
-- rows on purpose: the router reads NULL as "has been waiting the longest",
-- which is the right answer for an agent whose threads all predate this column.
ALTER TABLE "conversation"
  ADD COLUMN "assignedAt" TIMESTAMPTZ(3);

-- Backfill the threads that already have an owner, so today's rotation is not
-- skewed by history. `updatedAt` is not when they were assigned, but it is the
-- closest thing the row records and it orders them plausibly.
UPDATE "conversation"
  SET "assignedAt" = "updatedAt"
  WHERE "assigneeId" IS NOT NULL;

-- --- The agent's own inbox --------------------------------------------------
-- Every list read on the support inbox is now anchored on the assignee, so it
-- leads the index; the router's per-agent load count reads the same columns.
CREATE INDEX "conversation_assigneeId_kind_status_lastMessageAt_idx"
  ON "conversation" ("assigneeId", "kind", "status", "lastMessageAt");
