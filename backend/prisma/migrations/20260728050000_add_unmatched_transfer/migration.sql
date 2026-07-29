-- Unattributed USDT (TRC-20) transfers.
--
-- AGENTS.md: money that arrives and matches no payment is never silently
-- dropped. Until now the only record of one was a log line, which failed in both
-- directions — the poller re-reads a five-minute overlap window every sweep, so
-- a single unattributable transfer re-warned every poll interval forever, and
-- nothing outside the log ever knew it existed.
--
-- The unique tx hash below is what fixes both: it gives a re-read sweep the same
-- "already seen" answer that a claimed payment.providerRef gives for a matched
-- transfer, and it gives a human a queue to reconcile from.

CREATE TABLE "unmatched_transfer" (
  "id" TEXT NOT NULL,
  "transactionHash" TEXT NOT NULL,
  "contractAddress" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  -- The raw on-chain integer plus its precision, never a float (AGENTS.md,
  -- Money). Same representation the payment row uses for a settled amount.
  "amountRaw" DECIMAL(38, 0) NOT NULL,
  "decimals" INTEGER NOT NULL,
  "blockAt" TIMESTAMPTZ(3) NOT NULL,
  "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sightings" INTEGER NOT NULL DEFAULT 1,
  "resolvedAt" TIMESTAMPTZ(3),
  "resolvedById" TEXT,
  "resolvedByName" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "unmatched_transfer_pkey" PRIMARY KEY ("id")
);

-- THE constraint this table exists for: one row per transfer, so re-reading the
-- overlap window is free instead of being a repeated warning.
CREATE UNIQUE INDEX "unmatched_transfer_transactionHash_key"
  ON "unmatched_transfer" ("transactionHash");

-- The queue's own order — open items first, newest transfer first within them.
CREATE INDEX "unmatched_transfer_resolvedAt_blockAt_idx"
  ON "unmatched_transfer" ("resolvedAt", "blockAt");

-- SetNull, like the refund's approver: the trail keeps the snapshotted name and
-- still reads after the account is gone.
ALTER TABLE "unmatched_transfer"
  ADD CONSTRAINT "unmatched_transfer_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "user" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
