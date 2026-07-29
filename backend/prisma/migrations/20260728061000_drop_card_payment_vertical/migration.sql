-- Drop the card-payment vertical.
--
-- Card payments are a later deployment. The models below were scaffolded ahead
-- of the code that would fill them and nothing ever wrote to any of them: no
-- saved card was ever created, no customer record ever attached, and no webhook
-- was ever accepted. Empty tables that look implemented are worse than absent
-- ones — a reader takes `payment_method` as a working feature, and the billing
-- screen was already reading a table that had no writer.
--
-- The portal now says "coming soon" for cards and collects in USDT (TRC-20)
-- only. When the card path is actually built, these shapes come back with the
-- code that uses them.

-- USDT is the only provider left. Any row still tagged STRIPE predates the card
-- path being deferred and could only be seed data (nothing ever charged a card),
-- so it is re-tagged rather than deleted — a payment row is a money record and
-- AGENTS.md keeps those.
UPDATE "payment" SET "provider" = 'USDT_TRC20' WHERE "provider" = 'STRIPE';

-- Postgres cannot remove a value from an enum in place; the type is rebuilt.
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
CREATE TYPE "PaymentProvider" AS ENUM ('USDT_TRC20');
ALTER TABLE "payment"
  ALTER COLUMN "provider" TYPE "PaymentProvider"
  USING ("provider"::text::"PaymentProvider");
DROP TYPE "PaymentProvider_old";

-- Card display columns. Brand and last four were the only card data we ever
-- held, and with no card path there is nothing to hold.
ALTER TABLE "payment" DROP COLUMN "cardBrand";
ALTER TABLE "payment" DROP COLUMN "cardLast4";

DROP TABLE "payment_method";
DROP TABLE "stripe_customer";
DROP TABLE "webhook_event";
