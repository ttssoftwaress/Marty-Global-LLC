-- Envelope-first mail scanning.
--
-- Post is now logged from the outside first: the operator photographs the sealed
-- envelope and files it, the customer sees it in their room and asks us to open
-- it, and the contents are scanned onto the SAME mail item. The envelope and
-- what was inside it must never read as two pieces of post, so nothing here
-- creates a second row — `mail_item_scan.kind` is what separates the two sets of
-- files hanging off one item.
--
-- Existing rows are all contents (everything filed before this was a full scan),
-- which is why the column defaults to CONTENTS rather than to the new stage.

-- CreateEnum
CREATE TYPE "MailScanKind" AS ENUM ('ENVELOPE', 'CONTENTS');

-- AlterEnum
-- The customer's "Scan" button. Settled by filing the contents rather than by a
-- resolution form, so it never carries a carrier or a tracking number.
ALTER TYPE "MailRequestType" ADD VALUE 'SCAN';

-- AlterTable
ALTER TABLE "mail_item_scan" ADD COLUMN     "kind" "MailScanKind" NOT NULL DEFAULT 'CONTENTS';

-- The envelope and the contents number their pages independently — page 1 of
-- each exists on the same item — so the kind becomes part of the unique key.
-- DropIndex
DROP INDEX "mail_item_scan_mailItemId_pageNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "mail_item_scan_mailItemId_kind_pageNumber_key" ON "mail_item_scan"("mailItemId", "kind", "pageNumber");
