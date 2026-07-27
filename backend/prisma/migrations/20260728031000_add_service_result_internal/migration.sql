-- The service's result form is completed by the TEAM and produces no
-- customer-facing record. Added for the virtual mail room: staff fill in the
-- address the room opens at, but what the customer receives is the mail room
-- itself at `/app/mailroom`, not a second record page for the same
-- subscription.
ALTER TABLE "service" ADD COLUMN "resultInternal" BOOLEAN NOT NULL DEFAULT false;
