-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('ORDER', 'SUPPORT');

-- AlterTable
ALTER TABLE "conversation" ADD COLUMN     "kind" "ConversationKind" NOT NULL DEFAULT 'SUPPORT';

-- Existing threads that hang off an order become ORDER conversations: that is
-- what they already were, and the order-detail screen must resolve them rather
-- than create a second thread beside the history the customer can see.
UPDATE "conversation" SET "kind" = 'ORDER' WHERE "orderId" IS NOT NULL;

-- An order has at most one conversation. Deduplicate before the constraint goes
-- on, keeping the thread with the most recent activity and re-parenting the
-- other threads' messages onto it so no correspondence is lost.
WITH ranked AS (
  SELECT
    "id",
    "orderId",
    ROW_NUMBER() OVER (
      PARTITION BY "orderId"
      ORDER BY "lastMessageAt" DESC NULLS LAST, "createdAt" DESC
    ) AS rn
  FROM "conversation"
  WHERE "orderId" IS NOT NULL AND "kind" = 'ORDER'
),
keeper AS (
  SELECT "orderId", "id" FROM ranked WHERE rn = 1
)
UPDATE "message" m
SET "conversationId" = k."id"
FROM ranked r
JOIN keeper k ON k."orderId" = r."orderId"
WHERE m."conversationId" = r."id" AND r.rn > 1;

-- The now-empty duplicates are soft-deleted rather than dropped: a conversation
-- is customer-facing correspondence, and AGENTS.md requires asking before any
-- hard delete.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "orderId"
      ORDER BY "lastMessageAt" DESC NULLS LAST, "createdAt" DESC
    ) AS rn
  FROM "conversation"
  WHERE "orderId" IS NOT NULL AND "kind" = 'ORDER'
)
UPDATE "conversation" c
SET "deletedAt" = NOW()
FROM ranked r
WHERE c."id" = r."id" AND r.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "conversation_orderId_kind_key" ON "conversation"("orderId", "kind");

-- CreateIndex
CREATE INDEX "conversation_kind_status_lastMessageAt_idx" ON "conversation"("kind", "status", "lastMessageAt");
