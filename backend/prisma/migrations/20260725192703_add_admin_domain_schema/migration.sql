-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INVITED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "MailRequestType" AS ENUM ('FORWARDING', 'SHREDDING');

-- CreateEnum
CREATE TYPE "MailRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MailLogAction" AS ENUM ('FORWARDED', 'SHREDDED', 'DOWNLOADED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED');

-- AlterEnum
ALTER TYPE "MessageAuthor" ADD VALUE 'INTERNAL_NOTE';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "conversation" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "regionCode" TEXT;

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "formSteps" JSONB;

-- CreateTable
CREATE TABLE "staff_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'INVITED',
    "permissions" TEXT[],
    "shortName" TEXT,
    "invitedAt" TIMESTAMPTZ(3),
    "joinedAt" TIMESTAMPTZ(3),
    "lastActiveAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "staff_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "region" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "region_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "service_region_offering" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "processingTime" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_region_offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_pricing_tier" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "regionCode" TEXT,
    "turnaround" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "service_pricing_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_request" (
    "id" TEXT NOT NULL,
    "mailItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "MailRequestType" NOT NULL,
    "status" "MailRequestStatus" NOT NULL DEFAULT 'PENDING',
    "shippingAddress" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "notes" TEXT,
    "processedById" TEXT,
    "processedByName" TEXT,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "mail_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_action_log" (
    "id" TEXT NOT NULL,
    "mailItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "action" "MailLogAction" NOT NULL,
    "mailItemLabel" TEXT NOT NULL,
    "processedById" TEXT,
    "processedByName" TEXT NOT NULL,
    "closedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_carrier" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_carrier_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT NOT NULL,
    "providerRef" TEXT,
    "processedById" TEXT,
    "processedByName" TEXT NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_profile_userId_key" ON "staff_profile"("userId");

-- CreateIndex
CREATE INDEX "staff_profile_status_roleKey_idx" ON "staff_profile"("status", "roleKey");

-- CreateIndex
CREATE INDEX "region_active_sortOrder_idx" ON "region"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "service_region_offering_regionCode_idx" ON "service_region_offering"("regionCode");

-- CreateIndex
CREATE UNIQUE INDEX "service_region_offering_serviceId_regionCode_key" ON "service_region_offering"("serviceId", "regionCode");

-- CreateIndex
CREATE INDEX "service_pricing_tier_serviceId_sortOrder_idx" ON "service_pricing_tier"("serviceId", "sortOrder");

-- CreateIndex
CREATE INDEX "mail_request_status_requestedAt_idx" ON "mail_request"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "mail_request_customerId_idx" ON "mail_request"("customerId");

-- CreateIndex
CREATE INDEX "mail_request_mailItemId_idx" ON "mail_request"("mailItemId");

-- CreateIndex
CREATE INDEX "mail_action_log_closedAt_idx" ON "mail_action_log"("closedAt");

-- CreateIndex
CREATE INDEX "mail_action_log_action_closedAt_idx" ON "mail_action_log"("action", "closedAt");

-- CreateIndex
CREATE INDEX "mail_action_log_customerId_idx" ON "mail_action_log"("customerId");

-- CreateIndex
CREATE INDEX "mail_carrier_active_sortOrder_idx" ON "mail_carrier"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "refund_providerRef_key" ON "refund"("providerRef");

-- CreateIndex
CREATE INDEX "refund_paymentId_idx" ON "refund"("paymentId");

-- CreateIndex
CREATE INDEX "refund_processedAt_idx" ON "refund"("processedAt");

-- CreateIndex
CREATE INDEX "conversation_status_lastMessageAt_idx" ON "conversation"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversation_assigneeId_idx" ON "conversation"("assigneeId");

-- CreateIndex
CREATE INDEX "order_status_createdAt_idx" ON "order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_assigneeId_idx" ON "order"("assigneeId");

-- CreateIndex
CREATE INDEX "order_regionCode_idx" ON "order"("regionCode");

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_region_offering" ADD CONSTRAINT "service_region_offering_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_region_offering" ADD CONSTRAINT "service_region_offering_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "region"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_pricing_tier" ADD CONSTRAINT "service_pricing_tier_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_pricing_tier" ADD CONSTRAINT "service_pricing_tier_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "region"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "region"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_request" ADD CONSTRAINT "mail_request_mailItemId_fkey" FOREIGN KEY ("mailItemId") REFERENCES "mail_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_request" ADD CONSTRAINT "mail_request_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_request" ADD CONSTRAINT "mail_request_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_action_log" ADD CONSTRAINT "mail_action_log_mailItemId_fkey" FOREIGN KEY ("mailItemId") REFERENCES "mail_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_action_log" ADD CONSTRAINT "mail_action_log_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
