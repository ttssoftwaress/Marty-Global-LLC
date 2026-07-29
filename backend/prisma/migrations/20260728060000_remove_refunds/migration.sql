-- Refunds are no longer part of the product: the ledger records what was
-- collected, and nothing in the app reverses a collection.

-- Any payment still carrying a reversal status settled in full as far as the
-- ledger is now concerned — the money reached us, which is what SUCCEEDED means.
-- Run before the enum is narrowed, or the cast below would fail on these rows.
UPDATE "payment" SET "status" = 'SUCCEEDED'
WHERE "status" IN ('REFUNDED', 'PARTIALLY_REFUNDED');

-- DropTable
DROP TABLE IF EXISTS "refund";

/*
 * The USDT watching guarantee is a partial index whose predicate compares
 * "status" against PaymentStatus literals, so it depends on the type and blocks
 * the swap below. Dropped here and recreated against the new type at the end —
 * the constraint it enforces is unchanged, and the whole migration is one
 * transaction, so no window exists where two payments could watch the same
 * (address, amount) pair.
 */
DROP INDEX "payment_watching_amount_unique";

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNDERPAID', 'OVERPAID');
ALTER TABLE "payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- Same definition as 20260727230000_add_usdt_payment_watching, against the
-- narrowed type.
CREATE UNIQUE INDEX "payment_watching_amount_unique"
  ON "payment" ("depositAddress", "usdtExpectedRaw")
  WHERE "deletedAt" IS NULL
    AND "depositAddress" IS NOT NULL
    AND "usdtExpectedRaw" IS NOT NULL
    AND "status" IN ('PENDING', 'PROCESSING', 'REQUIRES_ACTION');
