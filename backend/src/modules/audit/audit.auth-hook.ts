import type { Prisma } from '@prisma/client';
import { APIError } from 'better-auth/api';
import { createAuthMiddleware } from 'better-auth/api';

import type { AuthContext } from '../../guards/auth-context.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { isRole, Role } from '../../lib/roles.js';
import { AuditAction, record } from './audit.service.js';

/*
 * The audit trail for authentication.
 *
 * Every other audit entry is written by a service, because every other audited
 * change goes through one. Authentication does not: Better Auth owns the whole
 * `/api/auth/*` subtree (AGENTS.md, Auth — "no custom sessions or password
 * handling"), so there is no service of ours to put a `record` call in. This
 * hook is that layer — it runs as Better Auth's own `hooks.after`, sees which
 * endpoint was called and whether it succeeded, and writes the entry.
 *
 * The alternative — wrapping the auth routes in Express middleware — was
 * rejected: the raw-body mount (app.ts) means a wrapper cannot read the request
 * without breaking signature verification, and a 200 from `/sign-in/email` is
 * not the same as a successful sign-in (Better Auth answers 200 with an error
 * body in some flows). The hook sees the resolved outcome instead of guessing at
 * it from a status code.
 *
 * Three rules hold throughout:
 *
 * 1. Never fail the request. Same rule as `audit.service.ts` — a trail is
 *    evidence, not a precondition, and an audit write must never be the reason
 *    somebody cannot sign in. Everything below is wrapped, and the hook returns
 *    without touching `ctx.context.returned`, so the response is unchanged
 *    whatever happens here.
 *
 * 2. Never store the submitted credential OR the submitted email. The password
 *    is obvious. The email is subtler and matters more: on a FAILED attempt the
 *    address is an unverified string chosen by an anonymous caller, so recording
 *    it both stores PII (AGENTS.md, Security & PII) and lets an attacker write
 *    arbitrary text into the admin's audit screen. What goes in instead is
 *    whether it matched a real account — which is the fact an investigation
 *    actually needs, and is ours, not the caller's.
 *
 * 3. The actor is resolved from the server's own state, never from the body.
 *    On success that is the session Better Auth just issued; on a failure it is
 *    a lookup we perform. A caller cannot nominate who the trail says they are.
 */

// Client IP. Behind the VPS reverse proxy the socket address is the proxy's, and
// app.ts trusts exactly one hop — so the last entry of the forwarded chain is the
// hop we trust. Reading the first would let a caller prepend anything they like.
function clientIp(headers: Headers | undefined): string | undefined {
  const forwarded = headers?.get('x-forwarded-for');
  const hop = forwarded?.split(',').at(-1)?.trim();
  return hop && hop.length > 0 ? hop : undefined;
}

/*
 * The audit actor for an auth event.
 *
 * `AuthContext` is what the rest of the codebase passes to `record`, and it
 * wants a session id — but half the events here have no session by definition (a
 * failed sign-in never gets one; a sign-out has just destroyed one). Those carry
 * the empty string rather than a fabricated id: the column the trail actually
 * stores is `actorId`, and inventing a session id to satisfy a type would put a
 * value in this file that matches no row anywhere.
 */
function actorFor(
  userId: string,
  role: unknown,
  email: string,
  sessionId = '',
): AuthContext {
  return {
    userId,
    role: isRole(role) ? role : Role.CUSTOMER,
    sessionId,
    email,
    emailVerified: true,
  };
}

/*
 * Which account a failed attempt was aimed at.
 *
 * Deliberately returns the id only. The address is read from the request body to
 * perform the lookup and then discarded — see rule 2 above; what is stored is
 * the id when one matched and nothing when none did.
 *
 * A miss is not an error. Signing in against an address with no account is the
 * single most common failed attempt there is, and the absence of an actor is
 * precisely what marks that row as an attempt against nobody.
 */
async function findAccount(
  email: unknown,
): Promise<{ id: string; role: string | null } | null> {
  if (typeof email !== 'string' || email.length === 0) return null;

  try {
    return await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, role: true },
    });
  } catch (error) {
    logger.error({ err: error }, 'Audit auth hook: account lookup failed');
    return null;
  }
}

/*
 * The paths this hook writes an entry for, and what each one means.
 *
 * Matched as prefixes for the same reason `guards/auth-rate-limit.ts` does:
 * Better Auth nests (`/sign-in/email`, `/sign-up/email`) and plugins add their
 * own suffixes. The trailing segment is kept as `method` in the metadata, so an
 * email sign-in and a future social one are distinguishable without a second
 * action value.
 *
 * `/get-session` is deliberately absent. The SPA calls it on every page load and
 * every tab focus, so auditing it would write tens of thousands of rows a day
 * that say nothing — a trail nobody can read is not a trail.
 */
const SIGN_IN = '/sign-in';
const SIGN_UP = '/sign-up';
const SIGN_OUT = '/sign-out';

// Better Auth serves three distinct password routes and they are NOT the same
// event to an investigator: `change-password` is the signed-in user choosing a
// new one, `reset-password` is somebody redeeming an emailed token, and
// `set-password` is a first credential on an account that had none. All three
// land on PASSWORD_CHANGED with the route in the metadata.
const PASSWORD_PATHS = ['/change-password', '/reset-password', '/set-password'];

// Requesting the email, as distinct from redeeming it above. Worth its own
// action: a burst of these against one account is an enumeration attempt, and it
// is the step that happens BEFORE anyone has proven anything.
const RESET_REQUEST_PATHS = ['/forget-password', '/request-password-reset'];

const EMAIL_CHANGE = '/change-email';

// The admin plugin's out-of-band account writes. The team service audits its own
// role changes (STAFF_UPDATED), but these routes bypass it entirely — they are
// Better Auth's, and without this they would move the column the guards read
// with no trail at all.
const ADMIN_ROUTES: { path: string; action: (typeof AuditAction)[keyof typeof AuditAction] }[] = [
  { path: '/admin/set-role', action: AuditAction.ROLE_CHANGED },
  { path: '/admin/ban-user', action: AuditAction.ACCOUNT_BANNED },
  { path: '/admin/unban-user', action: AuditAction.ACCOUNT_UNBANNED },
  { path: '/admin/revoke-user-sessions', action: AuditAction.SESSIONS_REVOKED },
  { path: '/admin/revoke-user-session', action: AuditAction.SESSIONS_REVOKED },
];

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function matchesAny(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => matches(path, prefix));
}

// The nested segment, if any: `/sign-in/email` → `email`. What distinguishes an
// email sign-in from a social one without a second action value.
function methodOf(path: string, prefix: string): string | undefined {
  const rest = path.slice(prefix.length).replace(/^\//, '');
  return rest.length > 0 ? rest : undefined;
}

type Body = Record<string, unknown>;

function bodyOf(value: unknown): Body {
  return typeof value === 'object' && value !== null ? (value as Body) : {};
}

/*
 * Why an attempt failed, as a short stable token rather than the provider's
 * prose. `record`'s metadata must never leak a provider error (AGENTS.md, API
 * Conventions), and Better Auth's own wording is not a contract — its message
 * text can change between releases while its error code does not.
 */
function failureReason(returned: unknown): string {
  if (returned instanceof APIError) {
    const body = bodyOf(returned.body);
    const code = body['code'];
    if (typeof code === 'string' && code.length > 0) return code;
    return String(returned.status);
  }
  return 'UNKNOWN';
}

function failed(returned: unknown): boolean {
  return returned instanceof APIError;
}

/*
 * The hook itself. Mounted as `hooks.after` in `config/auth.ts`, so it runs
 * after every endpoint in the subtree — including the ones that threw, because
 * Better Auth converts a thrown APIError into the response before after-hooks
 * run. That is what makes a failed sign-in auditable at all.
 */
export const auditAuthHook = createAuthMiddleware(async (ctx) => {
  try {
    await writeAuthAudit(ctx);
  } catch (error) {
    // Rule 1: the trail never breaks the request.
    logger.error({ err: error, path: ctx.path }, 'Audit auth hook failed');
  }
});

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

async function writeAuthAudit(ctx: HookContext): Promise<void> {
  const path = ctx.path.toLowerCase();
  const ipAddress = clientIp(ctx.headers);
  const returned = ctx.context.returned;
  const didFail = failed(returned);

  // The session Better Auth just issued (sign-in, sign-up), or the caller's
  // existing one (password change, email change). Never read from the body.
  const issued = ctx.context.newSession;
  const current = ctx.context.session;

  const write = (
    action: (typeof AuditAction)[keyof typeof AuditAction],
    actor: AuthContext | null,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ): void => {
    void record({
      actor,
      action,
      // The user row is what every auth event happens TO — the session is a
      // consequence of it, and a session id would point at a row that is
      // routinely deleted moments later.
      entityType: 'User',
      entityId,
      metadata,
      ...(ipAddress === undefined ? {} : { ipAddress }),
    });
  };

  // --- Sign in -----------------------------------------------------------
  if (matches(path, SIGN_IN)) {
    const method = methodOf(path, SIGN_IN);
    const base = { ...(method === undefined ? {} : { method }) };

    if (didFail) {
      /*
       * Rule 2 and rule 3 together. The address is looked up and dropped; what
       * lands in the row is the account it hit, or nothing when it hit none.
       * `matchedAccount: false` is what tells an admin the difference between
       * "somebody is guessing this person's password" and "somebody is guessing
       * addresses" — two very different findings from the same screen.
       */
      const account = await findAccount(bodyOf(ctx.body)['email']);

      write(
        AuditAction.SIGN_IN_FAILED,
        account ? actorFor(account.id, account.role, '') : null,
        // With no account matched there is no user row to point at. The literal
        // marks the row as an attempt against nobody rather than leaving the
        // column empty, which would read as a missing value.
        account?.id ?? 'unknown',
        { ...base, reason: failureReason(returned), matchedAccount: account !== null },
      );
      return;
    }

    if (!issued) return;

    write(
      AuditAction.SIGN_IN,
      actorFor(issued.user.id, issued.user.role, issued.user.email, issued.session.id),
      issued.user.id,
      base,
    );
    return;
  }

  // --- Sign up -----------------------------------------------------------
  if (matches(path, SIGN_UP)) {
    // A failed signup is a validation error or a duplicate address, not a
    // security event — and auditing it would store the submitted email for the
    // same reason rule 2 forbids. Only the account that came into existence is
    // recorded.
    if (didFail || !issued) return;

    write(
      AuditAction.SIGN_UP,
      actorFor(issued.user.id, issued.user.role, issued.user.email, issued.session.id),
      issued.user.id,
      { ...(methodOf(path, SIGN_UP) === undefined ? {} : { method: methodOf(path, SIGN_UP) }) },
    );
    return;
  }

  // --- Sign out ----------------------------------------------------------
  if (matches(path, SIGN_OUT)) {
    // The session is read before the endpoint destroys it — `ctx.context.session`
    // is resolved on the way in, which is the only reason a sign-out has an
    // actor at all.
    if (didFail || !current) return;

    write(
      AuditAction.SIGN_OUT,
      actorFor(current.user.id, current.user.role, current.user.email, current.session.id),
      current.user.id,
      {},
    );
    return;
  }

  // --- Password ----------------------------------------------------------
  if (matchesAny(path, PASSWORD_PATHS)) {
    /*
     * A failure here IS worth recording, unlike a failed signup: the common one
     * is a wrong current password on `/change-password`, which is somebody
     * sitting at a signed-in session trying to take it over. The actor is the
     * session that made the call.
     *
     * `/reset-password` is the exception — it is redeemed with a token by a
     * caller who has no session, so a failed one has no actor to attribute and
     * nothing useful to say. It writes only on success, where the endpoint has
     * just changed a real account's credential.
     */
    if (!current) return;

    write(
      AuditAction.PASSWORD_CHANGED,
      actorFor(current.user.id, current.user.role, current.user.email, current.session.id),
      current.user.id,
      // `route` is what separates a user-chosen change from a token redemption
      // and from a first credential being set — three different events sharing
      // one action value.
      { route: path, succeeded: !didFail, ...(didFail ? { reason: failureReason(returned) } : {}) },
    );
    return;
  }

  // --- Password reset requested ------------------------------------------
  if (matchesAny(path, RESET_REQUEST_PATHS)) {
    /*
     * Better Auth answers this identically whether the address exists or not, so
     * it cannot be used to enumerate accounts — and this row must not undo that.
     * The account is resolved server-side purely to attribute the row; nothing
     * about the response changes, and the submitted address is never stored.
     */
    const account = await findAccount(bodyOf(ctx.body)['email']);
    if (!account) return;

    write(
      AuditAction.PASSWORD_RESET_REQUESTED,
      actorFor(account.id, account.role, ''),
      account.id,
      { succeeded: !didFail },
    );
    return;
  }

  // --- Email change ------------------------------------------------------
  if (matches(path, EMAIL_CHANGE)) {
    if (didFail || !current) return;

    // Neither address goes in. That the account's address moved is the event;
    // which addresses were involved is PII, and both are already on the user row
    // and in the notification the change sends.
    write(
      AuditAction.EMAIL_CHANGED,
      actorFor(current.user.id, current.user.role, current.user.email, current.session.id),
      current.user.id,
      {},
    );
    return;
  }

  // --- Admin plugin account writes ---------------------------------------
  const adminRoute = ADMIN_ROUTES.find((route) => matches(path, route.path));

  if (adminRoute) {
    if (didFail || !current) return;

    /*
     * The target is read from the body here, unlike everywhere else in this
     * file, and that is safe for the opposite reason rule 3 exists: the caller
     * is an authenticated admin, the endpoint has already succeeded against that
     * id, and the value is an opaque cuid rather than PII. The actor is still
     * the session, never the body.
     */
    const body = bodyOf(ctx.body);
    const targetId = body['userId'];
    const nextRole = body['role'];

    if (typeof targetId !== 'string' || targetId.length === 0) return;

    write(
      adminRoute.action,
      actorFor(current.user.id, current.user.role, current.user.email, current.session.id),
      targetId,
      {
        via: 'better-auth-admin',
        ...(adminRoute.action === AuditAction.ROLE_CHANGED && typeof nextRole === 'string'
          ? { roleTo: nextRole }
          : {}),
      },
    );
  }
}
