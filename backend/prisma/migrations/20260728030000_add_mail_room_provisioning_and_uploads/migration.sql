-- Virtual mail: room provisioning, multi-file scans, and the mail notification
-- preference category.

-- AlterTable: the mail category on the settings notification matrix.
ALTER TABLE "notification_preference"
    ADD COLUMN "mailUpdatesEmail" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "mailUpdatesInApp" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "mailUpdatesSms" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: the order line whose delivery provisioned the room. Unique, so
-- delivering the same item twice cannot mint a second room.
ALTER TABLE "mail_room" ADD COLUMN "orderItemId" TEXT;

-- AlterTable: a scan is now several uploaded files, each keeping the metadata
-- the viewer needs to choose a renderer.
ALTER TABLE "mail_item_scan"
    ADD COLUMN "contentType" TEXT,
    ADD COLUMN "fileName" TEXT,
    ADD COLUMN "sizeBytes" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "mail_room_orderItemId_key" ON "mail_room"("orderItemId");

-- AddForeignKey: SetNull rather than Cascade — a room that has been receiving
-- post for months must outlive the order line that created it.
ALTER TABLE "mail_room" ADD CONSTRAINT "mail_room_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
