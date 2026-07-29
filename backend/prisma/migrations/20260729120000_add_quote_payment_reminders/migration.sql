-- Payment reminders on the billing ledger.
--
-- "Send reminder" is the action the ledger offers on every unpaid invoice, and
-- until now it had nothing behind it: the button rendered, the click did
-- nothing, and no record of a chase existed anywhere.
--
-- The two columns are the throttle, not just history. The cooldown is enforced
-- as a conditional UPDATE on `lastRemindedAt` — the same claim pattern the
-- notification delivery path uses — so two reviewers (or one double-click) can
-- never send the same customer two emails about the same invoice. Deriving the
-- last chase from the notification ledger instead would have made that check a
-- read-then-write with a race between the halves.
--
-- Both columns are nullable/defaulted, so every existing quote reads as "never
-- reminded" and is immediately chaseable.

ALTER TABLE "quote"
  ADD COLUMN "lastRemindedAt" TIMESTAMPTZ(3),
  ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
