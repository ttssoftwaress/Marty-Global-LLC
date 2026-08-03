-- Outbound email as a switch, not a redeploy.
--
-- WHY THIS EXISTS.
--
--   Every email in this system is a `notification` row plus a queued job. When
--   the transport refuses the send — a sending domain still in the SES sandbox
--   rejects every address it has not verified — the job burns its five attempts,
--   the row goes FAILED, and the job sits in the failed queue for a week. A
--   monitor counting failed background jobs then flips on work nobody can fix
--   until AWS grants production access, and the only way to stop it is to change
--   code.
--
--   `notification_settings.emailEnabled` is that stop, in one click, and it is
--   deliberately the same shape as `payment_settings.usdtAutoVerifyEnabled`: the
--   parts of this system that hand work to a provider are the parts most likely
--   to need standing down in a hurry.
--
--   One row by construction — the id defaults to 'singleton' and the service
--   upserts it. A settings table with a row count is a settings table someone
--   eventually writes twice. Nothing seeds it, for the same reason nothing seeds
--   locations or payment settings: the column defaults are the answer a fresh
--   database gives, which is "email is on".
--
-- SUPPRESSED.
--
--   A fourth notification status, and NOT a synonym for FAILED. FAILED is a
--   delivery that was tried and did not work; SUPPRESSED was never attempted
--   because sending was switched off when it came due. Conflating them would
--   make a deliberate pause read as an incident in every count of failures —
--   precisely the noise the switch exists to remove.
--
--   It is terminal. Switching email back on does not resend the backlog: a pause
--   of any length would otherwise end in a burst of stale mail about orders the
--   customer has long since seen in the app. The row keeps its rendered body, so
--   anything genuinely still owed can be raised again deliberately.

ALTER TYPE "NotificationStatus" ADD VALUE 'SUPPRESSED';

CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDisabledReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);
