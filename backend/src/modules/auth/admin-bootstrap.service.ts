import { auth } from '../../config/auth.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { Role } from '../../lib/roles.js';

/*
 * The bootstrap admin account.
 *
 * The admin portal is role-guarded, and the admin plugin's create-user endpoint
 * itself requires an admin session — so the first admin can never be created
 * through the API. This closes that loop: ADMIN_EMAIL / ADMIN_PASSWORD in server
 * env become exactly one `admin` user, reconciled on every boot.
 *
 * Better Auth still owns the credential end to end (AGENTS.md "Auth" — no custom
 * sessions or password handling). We call its own create-user endpoint and its
 * own hasher; we never write a password column ourselves. The endpoint permits a
 * session-less server-side call precisely for this case, so we pass no headers.
 *
 * Idempotent — safe on every restart:
 *   • no such user            → create it as `admin`
 *   • exists, wrong role      → promote to `admin`
 *   • exists, password drifted→ reset it to ADMIN_PASSWORD
 *   • exists, soft-deleted    → restore
 *   • env unset               → no-op
 *
 * Because the password is re-applied from env, rotating ADMIN_PASSWORD and
 * restarting is the supported way to change it — env is the source of truth.
 */

type BootstrapOutcome = 'skipped' | 'created' | 'updated' | 'unchanged';

export async function ensureAdminAccount(): Promise<BootstrapOutcome> {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = env;

  // env.ts already refuses a half-configured pair, so one being set means both are.
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    logger.debug('Admin bootstrap skipped — ADMIN_EMAIL / ADMIN_PASSWORD not set');
    return 'skipped';
  }

  // Better Auth lowercases the email on create, so match on the same form.
  const email = ADMIN_EMAIL.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, name: true, deletedAt: true },
  });

  if (!existing) {
    const { user } = await auth.api.createUser({
      body: {
        email,
        password: ADMIN_PASSWORD,
        name: ADMIN_NAME,
        role: Role.ADMIN,
      },
    });

    // The admin is staff, not a customer signing up — there is no verification
    // email to send, and requireVerifiedEmail would otherwise lock them out.
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    logger.info({ userId: user.id }, 'Admin account created from env');
    return 'created';
  }

  const changes: string[] = [];

  if (existing.role !== Role.ADMIN) {
    changes.push('role');
  }
  if (existing.deletedAt) {
    changes.push('restored');
  }

  if (changes.length > 0) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: Role.ADMIN, deletedAt: null, emailVerified: true },
    });
  }

  // The password is re-applied whenever it no longer matches env — that covers
  // both a rotated ADMIN_PASSWORD and an account that has no credential account
  // at all (e.g. created by an earlier seed).
  if (await syncAdminPassword(existing.id, ADMIN_PASSWORD)) {
    changes.push('password');
  }

  if (changes.length === 0) {
    logger.debug({ userId: existing.id }, 'Admin account already in sync');
    return 'unchanged';
  }

  // Log the fields that changed, never the values (AGENTS.md, Security & PII).
  logger.info({ userId: existing.id, changes }, 'Admin account reconciled from env');
  return 'updated';
}

/*
 * Bring the credential account in line with ADMIN_PASSWORD, returning whether
 * anything changed. Hashing and verification both go through Better Auth's own
 * password config, so the stored hash stays in the format it expects.
 */
async function syncAdminPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const ctx = await auth.$context;

  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const credential = accounts.find((account) => account.providerId === 'credential');

  if (credential?.password) {
    if (await matchesStoredPassword(ctx, credential.password, password)) return false;

    await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
    return true;
  }

  // Row exists but has no password to sign in with — link one.
  await ctx.internalAdapter.linkAccount({
    accountId: userId,
    providerId: 'credential',
    password: await ctx.password.hash(password),
    userId,
  });
  return true;
}

/*
 * Better Auth's verify throws on a hash it cannot parse rather than returning
 * false. An unreadable hash is exactly the case this bootstrap exists to repair,
 * so treat it as "does not match" and let the caller overwrite it — otherwise a
 * corrupted column would fail the boot check instead of healing itself.
 */
async function matchesStoredPassword(
  ctx: Awaited<typeof auth.$context>,
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await ctx.password.verify({ hash, password });
  } catch (err) {
    logger.warn({ err }, 'Stored admin password hash is unreadable — replacing it');
    return false;
  }
}
