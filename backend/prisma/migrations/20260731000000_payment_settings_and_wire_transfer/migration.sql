-- Payment configuration as data, and wire transfer as a second provider.
--
-- Two changes that belong together, because the second is only possible once the
-- first exists.
--
-- 1. HOW WE COLLECT STOPS BEING ENVIRONMENT VARIABLES.
--
--    The receiving address, the USD->USDT rate, the rate TTL, the confirmation
--    depth, and the poll interval all lived in `config/env.ts`, so rotating a
--    wallet or adjusting a spread was a redeploy. They are operational
--    decisions — the same argument that moved locations and carriers out of the
--    seed script — so they become one admin-managed row, edited at
--    `/admin/settings`.
--
--    Two values deliberately did NOT move and stay in server env:
--    TRONGRID_API_KEY (a credential — AGENTS.md, Security & PII) and
--    TRON_NETWORK (it pins which hardcoded USDT contract address a transfer is
--    verified against, and flipping it would change which chain real invoices
--    are credited from).
--
--    `usdtAutoVerifyEnabled` is the switch for the chain sweep itself. Automatic
--    crediting is the part of this system most likely to need stopping in a
--    hurry — a TronGrid outage serving stale data, a suspected mis-credit — and
--    without it the only way to stop it is a redeploy.
--
--    One row by construction: the id defaults to 'singleton' and the service
--    upserts it. A settings table with a row count is a settings table someone
--    eventually writes twice.
--
-- 2. WIRE TRANSFER, SETTLED BY A PERSON.
--
--    The mirror of USDT in what the customer is shown — an address and an amount
--    to send — and its opposite in how it settles: nothing here reads a bank
--    feed, so a member of the team holding `payments.settle` confirms the money
--    arrived. `settledById` / `settledByName` / `settlementNote` are that
--    decision's record, and the name is snapshotted so the trail still reads
--    after the account is gone (the same shape `unmatched_transfer` uses).
--
--    `bank_account_field` is the point of the whole feature. Banking details are
--    not the same shape in two countries — a US account has a routing number and
--    no IBAN, a UK one has a sort code, a SEPA one has neither — so a table of
--    fixed `iban` / `swift` / `sortCode` columns would make every new market a
--    migration. The admin owns both halves of every row, labels included, and
--    the checkout card renders what they entered in the order they set.
--
--    `payment.wireInstructions` is that card frozen at intent time. The live
--    account is editable, so a customer looking at "send to IBAN X" must keep
--    seeing X after someone corrects a typo — otherwise reconciliation becomes
--    an argument about which details were on screen at the time.
--
-- `payment.requiredConfirmations` locks the depth quoted to a customer onto
-- their own row, for the same reason `lockedRateMinor` already locks the rate:
-- both are now admin-editable, and reading the live value mid-flight would
-- credit a transfer at a shallower depth than the screen promised.
--
-- Every new column is nullable or defaulted, so no existing row needs a backfill
-- and no payment already in flight changes shape.

-- Postgres 12+ allows ADD VALUE inside a transaction as long as the new value is
-- not USED in the same one. Nothing below inserts a WIRE_TRANSFER row.
ALTER TYPE "PaymentProvider" ADD VALUE 'WIRE_TRANSFER';

CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "usdtEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tronDepositAddress" TEXT,
    "usdtUsdRateMinor" INTEGER NOT NULL DEFAULT 1000000,
    "usdtRateTtlMinutes" INTEGER NOT NULL DEFAULT 30,
    "tronMinConfirmations" INTEGER NOT NULL DEFAULT 19,
    "tronPollIntervalSeconds" INTEGER NOT NULL DEFAULT 30,
    "usdtAutoVerifyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wireEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wireInstructions" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_account" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "bank_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_account_field" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "copyable" BOOLEAN NOT NULL DEFAULT true,
    "emphasis" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_account_field_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payment" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "bankAccountLabel" TEXT,
ADD COLUMN     "customerMarkedSentAt" TIMESTAMPTZ(3),
ADD COLUMN     "requiredConfirmations" INTEGER,
ADD COLUMN     "settledById" TEXT,
ADD COLUMN     "settledByName" TEXT,
ADD COLUMN     "settlementNote" TEXT,
ADD COLUMN     "wireInstructions" JSONB;

-- The code is what a payment was issued under, so it is unique across archived
-- rows too: reusing it would attach a closed account's history to a new bank.
CREATE UNIQUE INDEX "bank_account_code_key" ON "bank_account"("code");

CREATE INDEX "bank_account_active_sortOrder_idx" ON "bank_account"("active", "sortOrder");

CREATE INDEX "bank_account_field_accountId_sortOrder_idx" ON "bank_account_field"("accountId", "sortOrder");

-- The manual settlement queue: open payments of the providers a human closes,
-- the ones the customer says they have sent first.
CREATE INDEX "payment_provider_status_customerMarkedSentAt_idx" ON "payment"("provider", "status", "customerMarkedSentAt");

-- SET NULL rather than RESTRICT: an account is retired when we stop banking with
-- it, and the payments collected through it have to survive that. Nothing a
-- customer or a reconciler reads breaks when it does, because the instructions
-- are snapshotted on the payment row.
ALTER TABLE "payment" ADD CONSTRAINT "payment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment" ADD CONSTRAINT "payment_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_account_field" ADD CONSTRAINT "bank_account_field_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bank_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
