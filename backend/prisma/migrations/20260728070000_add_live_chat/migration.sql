-- Live chat (Socket.io) — the persistence this feature needed that the tables
-- did not already have.
--
-- Three things land here:
--   1. Guest visitors, so the marketing site can chat without an account.
--   2. A staff-side read marker, the other half of read receipts.
--   3. An agent's own Online/Away switch, which decides whether a customer's
--      message triggers the offline email handoff.
--
-- Sockets themselves need no schema: they are transport only, and every message
-- was already a row (AGENTS.md, Live Chat).

-- --- Staff availability ----------------------------------------------------
-- Separate from "has a socket connected". Connected is a fact about a browser
-- tab; available is a statement of intent.
CREATE TYPE "StaffAvailability" AS ENUM ('ONLINE', 'AWAY');

ALTER TABLE "staff_profile"
  ADD COLUMN "availability" "StaffAvailability" NOT NULL DEFAULT 'ONLINE';

-- --- Guest visitors --------------------------------------------------------
-- A visitor chatting from the marketing site. Never becomes a User — there is no
-- merge path by design — and is purged wholesale 7 days after their last message.
CREATE TABLE "guest_visitor" (
  "id" TEXT NOT NULL,
  -- SHA-256 of the token the browser holds in localStorage. Storing the token
  -- itself would make a read-only leak of this table a takeover of every live
  -- guest conversation.
  "tokenHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdIp" TEXT,
  -- Drives the 7-day window; bumped by every message in either direction, so an
  -- active conversation is never cut off mid-flow.
  "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "guest_visitor_pkey" PRIMARY KEY ("id")
);

-- The token is the whole identity check, so its lookup must be unique and indexed.
CREATE UNIQUE INDEX "guest_visitor_tokenHash_key" ON "guest_visitor" ("tokenHash");

-- The purge job's scan: everything untouched since the cutoff.
CREATE INDEX "guest_visitor_lastSeenAt_idx" ON "guest_visitor" ("lastSeenAt");

-- --- Conversation ----------------------------------------------------------
-- A guest thread has no account behind it, so the owning column becomes
-- nullable. Every customer-scoped read is `customerId = <their id>`, which a
-- NULL can never satisfy — a guest thread is therefore invisible to the portal
-- by construction rather than by a filter someone has to remember to write.
ALTER TABLE "conversation" ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "conversation"
  ADD COLUMN "guestId" TEXT,
  -- The staff half of read receipts. A timestamp rather than a per-message flag:
  -- a thread is read up to a point in time, so one marker answers it for every
  -- message at once and cannot drift out of step with itself.
  ADD COLUMN "staffReadAt" TIMESTAMPTZ(3);

-- Cascade, unlike the other relations on this table: purging a visitor is meant
-- to take their conversation and its messages with it in one statement.
ALTER TABLE "conversation"
  ADD CONSTRAINT "conversation_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "guest_visitor" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "conversation_guestId_idx" ON "conversation" ("guestId");

-- Exactly one owner. Prisma cannot express this, and the services enforce it,
-- but a thread owned by both or by neither would be unreachable from one screen
-- and duplicated on another — cheap to make impossible at the column level.
ALTER TABLE "conversation"
  ADD CONSTRAINT "conversation_owner_exactly_one"
  CHECK (("customerId" IS NOT NULL) <> ("guestId" IS NOT NULL));
