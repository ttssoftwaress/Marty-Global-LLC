-- Idempotency-Key storage for the three admin writes that reach the customer.
--
-- AGENTS.md ("API Conventions") requires mutating endpoints to be retry-safe.
-- `Payment.idempotencyKey` already carries the key for the customer's own
-- checkout; these three writes had no equivalent, and each of them has a side
-- effect that cannot be taken back:
--
--   order_activity  — a customer-visible reply queues them an email
--   order_document  — a request placeholder notifies them we are waiting on it
--   quote           — a sent quote emails a price and advances the order
--
-- A network retry or a double-submit therefore duplicated a row AND re-sent the
-- message. The unique index is the guard: the writer stores the caller's key
-- with the row, so a replay finds the original and returns it instead of
-- creating a second one, and two genuinely concurrent submits race on the
-- constraint rather than both winning.
--
-- All three columns are nullable, so every existing row — and every row a job
-- writes, which has no request and no key — is unaffected. Postgres treats NULLs
-- as distinct in a unique index, so keyless rows never collide with each other.

ALTER TABLE "order_activity" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "order_document" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "quote" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "order_activity_idempotencyKey_key" ON "order_activity"("idempotencyKey");
CREATE UNIQUE INDEX "order_document_idempotencyKey_key" ON "order_document"("idempotencyKey");
CREATE UNIQUE INDEX "quote_idempotencyKey_key" ON "quote"("idempotencyKey");
