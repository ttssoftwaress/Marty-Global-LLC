-- CreateEnum
CREATE TYPE "FeedNotificationCategory" AS ENUM ('ORDER', 'BILLING', 'DOCUMENT', 'MESSAGE', 'PAYMENT', 'MAILROOM');

-- CreateEnum
CREATE TYPE "OrderDocumentStatus" AS ENUM ('PENDING', 'AVAILABLE', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderDocumentSource" AS ENUM ('TEAM', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "OrderActivityAuthor" AS ENUM ('TEAM', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MailRoomStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MailItemStatus" AS ENUM ('NEW', 'VIEWED', 'SCANNED', 'FORWARDED', 'ACTION_REQUESTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConversationCategory" AS ENUM ('FORMATION', 'ECOMMERCE', 'MAILROOM', 'BILLING', 'DOCUMENTS', 'SUPPORT');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('CUSTOMER', 'AGENT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'USDT_TRC20');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'UNDERPAID', 'OVERPAID');

-- CreateTable
CREATE TABLE "customer_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "avatarKey" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "customer_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "industry" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailMaster" BOOLEAN NOT NULL DEFAULT true,
    "statusUpdatesEmail" BOOLEAN NOT NULL DEFAULT true,
    "statusUpdatesInApp" BOOLEAN NOT NULL DEFAULT true,
    "statusUpdatesSms" BOOLEAN NOT NULL DEFAULT false,
    "quoteAlertsEmail" BOOLEAN NOT NULL DEFAULT true,
    "quoteAlertsInApp" BOOLEAN NOT NULL DEFAULT true,
    "quoteAlertsSms" BOOLEAN NOT NULL DEFAULT false,
    "documentRequestsEmail" BOOLEAN NOT NULL DEFAULT true,
    "documentRequestsInApp" BOOLEAN NOT NULL DEFAULT true,
    "documentRequestsSms" BOOLEAN NOT NULL DEFAULT false,
    "newMessagesEmail" BOOLEAN NOT NULL DEFAULT true,
    "newMessagesInApp" BOOLEAN NOT NULL DEFAULT true,
    "newMessagesSms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FeedNotificationCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "feed_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_document" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrderDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "OrderDocumentSource" NOT NULL DEFAULT 'TEAM',
    "objectKey" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "order_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_activity" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "author" "OrderActivityAuthor" NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUserId" TEXT,
    "message" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_room" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "status" "MailRoomStatus" NOT NULL DEFAULT 'PENDING',
    "renewsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "mail_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_item" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "status" "MailItemStatus" NOT NULL DEFAULT 'NEW',
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "storageExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "scanReady" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "responseDueAt" TIMESTAMPTZ(3),
    "pdfObjectKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "mail_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_item_scan" (
    "id" TEXT NOT NULL,
    "mailItemId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_item_scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "ConversationCategory" NOT NULL DEFAULT 'SUPPORT',
    "orderId" TEXT,
    "lastMessageAt" TIMESTAMPTZ(3),
    "preview" TEXT,
    "customerReadAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "author" "MessageAuthor" NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentType" TEXT,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "message_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "serviceName" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3) NOT NULL,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_item" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quote_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quoteId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "providerRef" TEXT,
    "depositAddress" TEXT,
    "usdtAmountRaw" DECIMAL(38,0),
    "usdtDecimals" INTEGER,
    "lockedRateMinor" INTEGER,
    "rateExpiresAt" TIMESTAMPTZ(3),
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "invoiceObjectKey" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stripe_customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_method" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_submission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "handledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "contact_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profile_userId_key" ON "customer_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_ownerId_key" ON "company"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_userId_key" ON "notification_preference"("userId");

-- CreateIndex
CREATE INDEX "feed_notification_userId_createdAt_idx" ON "feed_notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "feed_notification_userId_readAt_idx" ON "feed_notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "order_document_orderId_idx" ON "order_document"("orderId");

-- CreateIndex
CREATE INDEX "order_activity_orderId_occurredAt_idx" ON "order_activity"("orderId", "occurredAt");

-- CreateIndex
CREATE INDEX "mail_room_customerId_createdAt_idx" ON "mail_room"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "mail_item_roomId_receivedAt_idx" ON "mail_item"("roomId", "receivedAt");

-- CreateIndex
CREATE INDEX "mail_item_roomId_status_idx" ON "mail_item"("roomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mail_item_scan_mailItemId_pageNumber_key" ON "mail_item_scan"("mailItemId", "pageNumber");

-- CreateIndex
CREATE INDEX "conversation_customerId_lastMessageAt_idx" ON "conversation"("customerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversation_orderId_idx" ON "conversation"("orderId");

-- CreateIndex
CREATE INDEX "message_conversationId_sentAt_idx" ON "message"("conversationId", "sentAt");

-- CreateIndex
CREATE INDEX "message_attachment_messageId_idx" ON "message_attachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_reference_key" ON "quote"("reference");

-- CreateIndex
CREATE INDEX "quote_customerId_createdAt_idx" ON "quote"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "quote_status_validUntil_idx" ON "quote"("status", "validUntil");

-- CreateIndex
CREATE INDEX "quote_line_item_quoteId_idx" ON "quote_line_item"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_providerRef_key" ON "payment"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_customerId_createdAt_idx" ON "payment"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE INDEX "payment_quoteId_idx" ON "payment"("quoteId");

-- CreateIndex
CREATE INDEX "payment_depositAddress_idx" ON "payment"("depositAddress");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customer_userId_key" ON "stripe_customer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customer_stripeCustomerId_key" ON "stripe_customer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_stripePaymentMethodId_key" ON "payment_method"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "payment_method_customerId_idx" ON "payment_method"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_provider_externalId_key" ON "webhook_event"("provider", "externalId");

-- CreateIndex
CREATE INDEX "contact_submission_createdAt_idx" ON "contact_submission"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "customer_profile" ADD CONSTRAINT "customer_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_notification" ADD CONSTRAINT "feed_notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_document" ADD CONSTRAINT "order_document_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activity" ADD CONSTRAINT "order_activity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_room" ADD CONSTRAINT "mail_room_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_item" ADD CONSTRAINT "mail_item_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "mail_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_item_scan" ADD CONSTRAINT "mail_item_scan_mailItemId_fkey" FOREIGN KEY ("mailItemId") REFERENCES "mail_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_item" ADD CONSTRAINT "quote_line_item_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_customer" ADD CONSTRAINT "stripe_customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
