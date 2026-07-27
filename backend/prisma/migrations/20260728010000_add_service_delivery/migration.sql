-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ServiceResultStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "completedAt" TIMESTAMPTZ(3),
ADD COLUMN     "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "resultFields" JSONB,
ADD COLUMN     "resultNoun" TEXT,
ADD COLUMN     "resultPageTitle" TEXT;

-- CreateTable
CREATE TABLE "result_field_definition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hint" TEXT,
    "config" JSONB,
    "category" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "showInList" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "result_field_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_type" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "fields" JSONB,
    "turnaround" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "service_request_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_result" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "status" "ServiceResultStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "deliveredAt" TIMESTAMPTZ(3),
    "lastEditedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "service_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_result_value" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT,
    "valueJson" JSONB,
    "objectKey" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_result_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "requestTypeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "typeLabel" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "answers" JSONB,
    "note" TEXT,
    "blockedReason" TEXT,
    "resolution" TEXT,
    "assigneeId" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "service_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_activity" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "author" "OrderActivityAuthor" NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUserId" TEXT,
    "message" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_request_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "result_field_definition_key_key" ON "result_field_definition"("key");

-- CreateIndex
CREATE INDEX "result_field_definition_archived_sortOrder_idx" ON "result_field_definition"("archived", "sortOrder");

-- CreateIndex
CREATE INDEX "service_request_type_serviceId_active_sortOrder_idx" ON "service_request_type"("serviceId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_type_serviceId_key_key" ON "service_request_type"("serviceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "service_result_orderItemId_key" ON "service_result"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "service_result_reference_key" ON "service_result"("reference");

-- CreateIndex
CREATE INDEX "service_result_customerId_serviceId_createdAt_idx" ON "service_result"("customerId", "serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "service_result_customerId_status_idx" ON "service_result"("customerId", "status");

-- CreateIndex
CREATE INDEX "service_result_orderId_idx" ON "service_result"("orderId");

-- CreateIndex
CREATE INDEX "service_result_value_fieldId_idx" ON "service_result_value"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "service_result_value_resultId_fieldKey_key" ON "service_result_value"("resultId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_reference_key" ON "service_request"("reference");

-- CreateIndex
CREATE INDEX "service_request_status_createdAt_idx" ON "service_request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "service_request_assigneeId_status_idx" ON "service_request"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "service_request_customerId_createdAt_idx" ON "service_request"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "service_request_resultId_idx" ON "service_request"("resultId");

-- CreateIndex
CREATE INDEX "service_request_serviceId_status_idx" ON "service_request"("serviceId", "status");

-- CreateIndex
CREATE INDEX "service_request_activity_requestId_occurredAt_idx" ON "service_request_activity"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "service_request_activity_requestId_internal_idx" ON "service_request_activity"("requestId", "internal");

-- CreateIndex
CREATE INDEX "order_item_serviceId_status_idx" ON "order_item"("serviceId", "status");

-- AddForeignKey
ALTER TABLE "service_request_type" ADD CONSTRAINT "service_request_type_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_result" ADD CONSTRAINT "service_result_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_result" ADD CONSTRAINT "service_result_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_result" ADD CONSTRAINT "service_result_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_result" ADD CONSTRAINT "service_result_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_result_value" ADD CONSTRAINT "service_result_value_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "service_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_result_value" ADD CONSTRAINT "service_result_value_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "result_field_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "service_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "service_request_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_activity" ADD CONSTRAINT "service_request_activity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
