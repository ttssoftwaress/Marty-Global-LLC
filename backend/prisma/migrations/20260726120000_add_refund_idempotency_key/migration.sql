-- AlterTable
ALTER TABLE "refund" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "refund_idempotencyKey_key" ON "refund"("idempotencyKey");
