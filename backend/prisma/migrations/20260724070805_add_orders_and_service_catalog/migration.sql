-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MISSING_INFO', 'APPROVED', 'COMPLETED');

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT NOT NULL,
    "features" TEXT[],
    "footer" JSONB NOT NULL,
    "detailFields" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_active_sortOrder_idx" ON "service"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "order_reference_key" ON "order"("reference");

-- CreateIndex
CREATE INDEX "order_customerId_createdAt_idx" ON "order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "order_status_idx" ON "order"("status");

-- CreateIndex
CREATE INDEX "order_item_orderId_idx" ON "order_item"("orderId");

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
