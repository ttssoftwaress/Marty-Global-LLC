-- MailItemStatus.SCANNED had no writer anywhere in the codebase, and could not
-- gain one without contradicting itself: whether a scan exists is already the
-- `scanReady` boolean, and the status column tracks the item's lifecycle
-- (unread → viewed → settled). An item cannot be both "scanned" and "unread" on
-- one column, so the value was unreachable by construction rather than by
-- oversight.

-- Any row still carrying it is unread mail — that is what the value was standing
-- in for. Run before the enum is narrowed, or the cast below fails on these rows.
UPDATE "mail_item" SET "status" = 'NEW' WHERE "status" = 'SCANNED';

-- AlterEnum
BEGIN;
CREATE TYPE "MailItemStatus_new" AS ENUM ('NEW', 'VIEWED', 'FORWARDED', 'ACTION_REQUESTED', 'ARCHIVED');
ALTER TABLE "mail_item" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "mail_item" ALTER COLUMN "status" TYPE "MailItemStatus_new" USING ("status"::text::"MailItemStatus_new");
ALTER TYPE "MailItemStatus" RENAME TO "MailItemStatus_old";
ALTER TYPE "MailItemStatus_new" RENAME TO "MailItemStatus";
DROP TYPE "MailItemStatus_old";
ALTER TABLE "mail_item" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;
