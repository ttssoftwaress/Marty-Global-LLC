-- USDT (TRC-20) payment watching.
--
-- TRC-20 transfers carry no memo or destination tag, so with one shared deposit
-- address the AMOUNT is the only discriminator between concurrently-watching
-- payments. These columns and the partial unique index below are what make a
-- transfer match exactly one payment row (AGENTS.md, Payments).

ALTER TABLE "payment"
  ADD COLUMN "usdtExpectedRaw" DECIMAL(38, 0),
  ADD COLUMN "expiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "chainConfirmedAt" TIMESTAMPTZ(3);

CREATE INDEX "payment_depositAddress_usdtExpectedRaw_idx"
  ON "payment" ("depositAddress", "usdtExpectedRaw");

-- The matching guarantee, enforced by the database rather than by application
-- logic that a race could slip past: at most one LIVE payment may watch a given
-- (address, amount) pair at a time.
--
-- Partial, because it must only constrain rows that are actually watching.
-- Settled, failed, expired, and soft-deleted rows keep their historical amounts,
-- and two customers paying the same invoice amount months apart is normal.
CREATE UNIQUE INDEX "payment_watching_amount_unique"
  ON "payment" ("depositAddress", "usdtExpectedRaw")
  WHERE "deletedAt" IS NULL
    AND "depositAddress" IS NOT NULL
    AND "usdtExpectedRaw" IS NOT NULL
    AND "status" IN ('PENDING', 'PROCESSING', 'REQUIRES_ACTION');

-- How far the poller has swept, so a restart resumes instead of re-reading the
-- chain from zero (or skipping what landed while the process was down).
CREATE TABLE "chain_sync_cursor" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "lastBlockTimestamp" BIGINT NOT NULL DEFAULT 0,
  "lastSweptAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "chain_sync_cursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chain_sync_cursor_provider_key"
  ON "chain_sync_cursor" ("provider");
