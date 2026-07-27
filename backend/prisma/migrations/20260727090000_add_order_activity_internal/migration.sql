-- AlterTable
ALTER TABLE "order_activity" ADD COLUMN     "internal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "order_activity_orderId_internal_idx" ON "order_activity"("orderId", "internal");
