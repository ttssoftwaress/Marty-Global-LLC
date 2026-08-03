-- Admin-defined job roles.
--
-- The five roles that used to be a hardcoded array in `lib/permissions.ts` become
-- rows an admin can relabel, re-grant, and add to. A member's own switches stop
-- being a copy of the role's defaults and become an *override* on top of it:
-- `permissionOverrides` records only the keys an admin decided personally for
-- that one account, so a later edit to the role moves every other member holding
-- it while those decisions survive.
--
-- `staff_profile.permissions` stays, materialized, because the guards check it on
-- every admin request and two assignee queries filter on it in SQL.

-- CreateTable
CREATE TABLE "staff_role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "authRole" TEXT NOT NULL,
    "permissions" TEXT[],
    "lockedPermissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_role_key_key" ON "staff_role"("key");

-- AlterTable
ALTER TABLE "staff_profile" ADD COLUMN     "permissionOverrides" JSONB NOT NULL DEFAULT '{}';

-- The five system roles, matching SYSTEM_STAFF_ROLES in lib/permissions.ts. They
-- are inserted here rather than left to the boot-time provisioner because the
-- foreign key below cannot be added until every `staff_profile.roleKey` resolves.
INSERT INTO "staff_role" ("id", "key", "label", "authRole", "permissions", "lockedPermissions", "isSystem", "sortOrder", "updatedAt")
VALUES
  ('sysrole_super_admin', 'super-admin', 'Super Admin', 'admin',
   ARRAY['orders','orders.assign','customers','requests','catalog','payments','payments.settle','mailroom','support','support.assign','reports','leads','team','settings','audit','orders.all','customers.all','requests.all','payments.all','mailroom.all','support.all','reports.all'],
   ARRAY['team'], true, 10, CURRENT_TIMESTAMP),
  ('sysrole_operations_manager', 'operations-manager', 'Operations Manager', 'admin',
   ARRAY['orders','orders.assign','customers','requests','catalog','payments','payments.settle','mailroom','support','support.assign','reports','settings','audit','orders.all','customers.all','requests.all','payments.all','mailroom.all','support.all','reports.all'],
   ARRAY[]::TEXT[], true, 20, CURRENT_TIMESTAMP),
  ('sysrole_reviewer', 'reviewer', 'Reviewer / Compliance', 'staff',
   ARRAY['orders','customers','requests','reports'],
   ARRAY[]::TEXT[], true, 30, CURRENT_TIMESTAMP),
  ('sysrole_support_agent', 'support-agent', 'Support Agent', 'staff',
   ARRAY['orders','customers','requests','support','leads'],
   ARRAY[]::TEXT[], true, 40, CURRENT_TIMESTAMP),
  ('sysrole_mail_operator', 'mail-operator', 'Mail Room Operator', 'staff',
   ARRAY['customers','mailroom'],
   ARRAY[]::TEXT[], true, 50, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- A profile pointing at a role key that never existed would fail the foreign key
-- and take the whole migration with it. Repointing it is not a demotion: the
-- backfill below turns its stored grant list into overrides, so the member keeps
-- exactly the access they had — only the label they are filed under changes.
UPDATE "staff_profile" p
SET "roleKey" = 'support-agent'
WHERE NOT EXISTS (SELECT 1 FROM "staff_role" r WHERE r."key" = p."roleKey");

-- Drop keys the catalogue no longer knows, so a legacy grant cannot survive as
-- an override of something nothing reads.
UPDATE "staff_profile" p
SET "permissions" = COALESCE((
  SELECT array_agg(k)
  FROM unnest(p."permissions") AS k
  WHERE k = ANY (ARRAY['orders','orders.assign','customers','requests','catalog','payments','payments.settle','mailroom','support','support.assign','reports','leads','team','settings','audit','orders.all','customers.all','requests.all','payments.all','mailroom.all','support.all','reports.all'])
), ARRAY[]::TEXT[]);

-- The backfill. Every key where the member's stored set disagrees with their
-- role's becomes an explicit override — `true` for something they hold that the
-- role does not give, `false` for something the role gives that they were denied.
-- Keys they agree on are left out entirely, which is what lets a future role edit
-- reach them.
--
-- Locked keys are excluded: they are forced on when the effective set is
-- computed, so an override on one would be a stored decision that never applies.
UPDATE "staff_profile" p
SET "permissionOverrides" = COALESCE((
  SELECT jsonb_object_agg(k, k = ANY (p."permissions"))
  FROM unnest(ARRAY['orders','orders.assign','customers','requests','catalog','payments','payments.settle','mailroom','support','support.assign','reports','leads','team','settings','audit','orders.all','customers.all','requests.all','payments.all','mailroom.all','support.all','reports.all']) AS k
  WHERE (k = ANY (p."permissions")) IS DISTINCT FROM (k = ANY (r."permissions"))
    AND NOT (k = ANY (r."lockedPermissions"))
), '{}'::jsonb)
FROM "staff_role" r
WHERE r."key" = p."roleKey";

-- A locked key is held whether or not it was stored, so make the materialized
-- column say so before anything reads it.
UPDATE "staff_profile" p
SET "permissions" = (
  SELECT COALESCE(array_agg(DISTINCT k), ARRAY[]::TEXT[])
  FROM unnest(p."permissions" || r."lockedPermissions") AS k
)
FROM "staff_role" r
WHERE r."key" = p."roleKey"
  AND array_length(r."lockedPermissions", 1) > 0;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_roleKey_fkey" FOREIGN KEY ("roleKey") REFERENCES "staff_role"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
