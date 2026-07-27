import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/*
 * `npm run db:reset` — empty the database, keeping only the bootstrap admin.
 *
 * A hard delete of every customer-facing record, which AGENTS.md ("Database")
 * otherwise forbids without asking: filings and payments carry regulatory
 * retention. This script exists because a development database has none of that
 * to protect — it is a deliberate, explicitly-invoked escape hatch, never
 * something the app calls. Hence the production refusal below.
 *
 * What survives: the `user` row whose email matches ADMIN_EMAIL, and the Better
 * Auth `account` rows that hold its credential. Nothing else — not the service
 * catalog, not the field registries, not regions or carriers. Re-run
 * `npm run db:seed` afterwards to put the catalog back.
 *
 * Sessions are cleared too, including the admin's: a wiped database means every
 * open tab is looking at rows that no longer exist, so a fresh sign-in is the
 * honest outcome. The admin's password is never touched — starting the server
 * (or `npm run admin:setup`) reconciles the account from env as it always does.
 *
 * The schema is left untouched — this truncates data, it never drops or
 * migrates. `prisma migrate reset` is the tool for rebuilding the schema itself.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — cannot reset.');
  process.exit(1);
}

const force = process.argv.includes('--force');

if (process.env.NODE_ENV === 'production' && !force) {
  console.error(
    'Refusing to wipe a production database. Re-run with --force if that is genuinely what you want.',
  );
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!adminEmail) {
  console.error(
    'ADMIN_EMAIL is not set — there would be no account to keep. Set it in .env, then re-run.',
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/*
 * Every table, children before parents.
 *
 * Most relations cascade, so a shorter list would mostly work — but four
 * relations are `Restrict` on purpose (a result value pins its field definition,
 * a request pins its type, a region offering pins its region, an order item pins
 * its service), and those are exactly the ones that would abort a partial wipe
 * halfway through. Listing every table in dependency order makes the delete
 * independent of what the schema happens to cascade today.
 */
async function clearAll(keepEmail: string): Promise<void> {
  await prisma.$transaction([
    // Support threads
    prisma.messageAttachment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),

    // Service delivery — values before their definitions, requests before types
    prisma.serviceRequestActivity.deleteMany(),
    prisma.serviceRequest.deleteMany(),
    prisma.serviceResultValue.deleteMany(),
    prisma.serviceResult.deleteMany(),
    prisma.serviceRequestType.deleteMany(),

    // Virtual mail rooms
    prisma.mailActionLog.deleteMany(),
    prisma.mailRequest.deleteMany(),
    prisma.mailItemScan.deleteMany(),
    prisma.mailItem.deleteMany(),
    prisma.mailRoom.deleteMany(),

    // Money — refunds before payments, lines before quotes
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.quoteLineItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.paymentMethod.deleteMany(),
    prisma.stripeCustomer.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.chainSyncCursor.deleteMany(),

    // Orders — items before the services they reference
    prisma.orderDocument.deleteMany(),
    prisma.orderActivity.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),

    // Catalog, registries, reference data
    prisma.servicePricingTier.deleteMany(),
    prisma.serviceRegionOffering.deleteMany(),
    prisma.service.deleteMany(),
    prisma.resultFieldDefinition.deleteMany(),
    prisma.fieldDefinition.deleteMany(),
    prisma.region.deleteMany(),
    prisma.mailCarrier.deleteMany(),

    // Notifications
    prisma.feedNotification.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.notification.deleteMany(),

    // People — profiles for everyone, including the admin's own staff record.
    // An `admin` role passes every permission area without one (admin.guards.ts),
    // so the kept account still reaches the whole admin portal.
    prisma.customerProfile.deleteMany(),
    prisma.company.deleteMany(),
    prisma.staffProfile.deleteMany(),

    // Marketing + audit trail
    prisma.contactSubmission.deleteMany(),
    prisma.auditLog.deleteMany(),

    // Better Auth — every session, every account and user except the admin's.
    prisma.session.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.account.deleteMany({ where: { user: { email: { not: keepEmail } } } }),
    prisma.user.deleteMany({ where: { email: { not: keepEmail } } }),
  ]);
}

async function main(keepEmail: string): Promise<void> {
  const kept = await prisma.user.findUnique({
    where: { email: keepEmail },
    select: { id: true },
  });

  await clearAll(keepEmail);

  /*
   * The account's role, password, and verified flag are deliberately not touched
   * here. `ensureAdminAccount` already reconciles all three from env on every
   * boot, and Better Auth owns the credential (AGENTS.md, Auth) — repairing a
   * demoted or soft-deleted admin from this script would be a second definition
   * of what a valid admin is. Point at the one that exists instead.
   */
  console.info(
    kept
      ? `Database reset — kept the admin account ${keepEmail}.`
      : `Database reset — no account exists for ${keepEmail}; run "npm run admin:setup" to create it.`,
  );
}

main(adminEmail)
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
