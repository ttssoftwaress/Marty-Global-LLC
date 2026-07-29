import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../lib/app-error.js';
import { Role } from '../lib/roles.js';
import type { AuthContext } from './auth-context.js';
import { getAuth } from './auth-context.js';
import { optionalAuth, requireAuth } from './require-auth.js';
import { assertFound, assertOwner, isStaff } from './ownership.js';
import { requireIdempotencyKey } from './require-idempotency-key.js';
import { requireAdmin, requireRole, requireStaff } from './require-role.js';
import { requireVerifiedEmail } from './require-verified-email.js';

// The session guards call Better Auth; the boundary worth testing is what this
// codebase does with each answer it can give, not Better Auth itself.
const getSession = vi.hoisted(() => vi.fn());
vi.mock('../config/auth.js', () => ({ auth: { api: { getSession } } }));

function actor(role: Role, userId = 'user_1'): AuthContext {
  return {
    userId,
    role,
    sessionId: 'sess_1',
    email: 'person@example.com',
    emailVerified: true,
  };
}

function mockReq(auth?: AuthContext, headers: Record<string, string> = {}) {
  return {
    auth,
    headers,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

const res = {} as Response;

// Runs a guard and returns whatever it passed to next() — undefined means allow.
function run(
  guard: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
): unknown {
  const next = vi.fn();
  guard(req, res, next);
  return next.mock.calls[0]?.[0];
}

describe('getAuth', () => {
  it('throws 401 when a route is missing its auth guard', () => {
    expect(() => getAuth(mockReq())).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
  });

  it('returns the context when authenticated', () => {
    const context = actor(Role.CUSTOMER);
    expect(getAuth(mockReq(context))).toBe(context);
  });
});

/*
 * The session boundary. Every protected route group sits behind requireAuth, so
 * each answer Better Auth can give has to land somewhere deliberate: a live
 * session, no session, a session belonging to a suspended account, and the
 * lookup itself failing.
 */
describe('session guards', () => {
  const session = (overrides: Record<string, unknown> = {}) => ({
    session: { id: 'sess_1' },
    user: {
      id: 'user_1',
      email: 'person@example.com',
      emailVerified: true,
      role: Role.CUSTOMER,
      banned: false,
      ...overrides,
    },
  });

  // The guards are async, so next() lands a tick after the call returns.
  async function runAsync(
    guard: (req: Request, res: Response, next: NextFunction) => Promise<void>,
    req: Request,
  ): Promise<unknown> {
    const next = vi.fn();
    await guard(req, res, next);
    return next.mock.calls[0]?.[0];
  }

  beforeEach(() => {
    getSession.mockReset();
  });

  describe('requireAuth', () => {
    it('attaches the resolved context and allows the request through', async () => {
      getSession.mockResolvedValue(session());

      const req = mockReq();
      expect(await runAsync(requireAuth, req)).toBeUndefined();
      expect(req.auth).toMatchObject({
        userId: 'user_1',
        role: Role.CUSTOMER,
        sessionId: 'sess_1',
        emailVerified: true,
      });
    });

    it('rejects a request with no session with 401', async () => {
      getSession.mockResolvedValue(null);

      const err = await runAsync(requireAuth, mockReq());
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(401);
    });

    it('rejects a suspended account with 403 even though the cookie is valid', async () => {
      getSession.mockResolvedValue(session({ banned: true, banExpires: null }));

      const err = await runAsync(requireAuth, mockReq());
      expect((err as AppError).status).toBe(403);
    });

    it('lets a lapsed ban through', async () => {
      getSession.mockResolvedValue(
        session({ banned: true, banExpires: new Date(Date.now() - 60_000) }),
      );

      expect(await runAsync(requireAuth, mockReq())).toBeUndefined();
    });

    it('falls back to the customer role for an unrecognised one', async () => {
      getSession.mockResolvedValue(session({ role: 'wizard' }));

      const req = mockReq();
      expect(await runAsync(requireAuth, req)).toBeUndefined();
      expect(req.auth?.role).toBe(Role.CUSTOMER);
    });

    it('passes a session-lookup failure to the error middleware', async () => {
      getSession.mockRejectedValue(new Error('auth store unreachable'));

      const err = await runAsync(requireAuth, mockReq());
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('optionalAuth', () => {
    it('attaches the context when a session exists', async () => {
      getSession.mockResolvedValue(session());

      const req = mockReq();
      expect(await runAsync(optionalAuth, req)).toBeUndefined();
      expect(req.auth?.userId).toBe('user_1');
    });

    it('continues anonymously when there is no session', async () => {
      getSession.mockResolvedValue(null);

      const req = mockReq();
      expect(await runAsync(optionalAuth, req)).toBeUndefined();
      expect(req.auth).toBeUndefined();
    });

    it('still rejects a suspended account rather than treating it as anonymous', async () => {
      getSession.mockResolvedValue(session({ banned: true, banExpires: null }));

      const err = await runAsync(optionalAuth, mockReq());
      expect((err as AppError).status).toBe(403);
    });

    it('continues anonymously when the session lookup fails', async () => {
      getSession.mockRejectedValue(new Error('auth store unreachable'));

      const req = mockReq();
      expect(await runAsync(optionalAuth, req)).toBeUndefined();
      expect(req.auth).toBeUndefined();
    });
  });
});

describe('requireRole', () => {
  it('rejects an unauthenticated request with 401, not 403', () => {
    const err = run(requireStaff, mockReq());
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(401);
  });

  it('rejects a customer from a staff route with 403', () => {
    const err = run(requireStaff, mockReq(actor(Role.CUSTOMER)));
    expect((err as AppError).status).toBe(403);
  });

  it('allows staff and admin through a staff route', () => {
    expect(run(requireStaff, mockReq(actor(Role.STAFF)))).toBeUndefined();
    expect(run(requireStaff, mockReq(actor(Role.ADMIN)))).toBeUndefined();
  });

  it('rejects staff from an admin-only route', () => {
    const err = run(requireAdmin, mockReq(actor(Role.STAFF)));
    expect((err as AppError).status).toBe(403);
  });

  it('allows only the listed roles', () => {
    const guard = requireRole(Role.ADMIN);
    expect(run(guard, mockReq(actor(Role.ADMIN)))).toBeUndefined();
    expect(run(guard, mockReq(actor(Role.CUSTOMER)))).toBeInstanceOf(AppError);
  });
});

describe('requireVerifiedEmail', () => {
  it('blocks an unverified account with 422', () => {
    const unverified = { ...actor(Role.CUSTOMER), emailVerified: false };
    const err = run(requireVerifiedEmail, mockReq(unverified));
    expect((err as AppError).status).toBe(422);
  });

  it('allows a verified account', () => {
    expect(
      run(requireVerifiedEmail, mockReq(actor(Role.CUSTOMER))),
    ).toBeUndefined();
  });
});

describe('requireIdempotencyKey', () => {
  it('rejects a missing key', () => {
    const err = run(requireIdempotencyKey, mockReq(actor(Role.CUSTOMER)));
    expect((err as AppError).status).toBe(400);
  });

  it('rejects a key that is too short', () => {
    const req = mockReq(actor(Role.CUSTOMER), { 'idempotency-key': 'short' });
    expect((run(requireIdempotencyKey, req) as AppError).status).toBe(400);
  });

  it('accepts a valid key and exposes it on the request', () => {
    const req = mockReq(actor(Role.CUSTOMER), {
      'idempotency-key': 'a-sufficiently-long-key',
    });
    expect(run(requireIdempotencyKey, req)).toBeUndefined();
    expect(req.idempotencyKey).toBe('a-sufficiently-long-key');
  });
});

describe('ownership', () => {
  const owner = actor(Role.CUSTOMER, 'owner_1');
  const other = actor(Role.CUSTOMER, 'other_1');

  it('treats staff and admin as staff, customers not', () => {
    expect(isStaff(actor(Role.STAFF))).toBe(true);
    expect(isStaff(actor(Role.ADMIN))).toBe(true);
    expect(isStaff(owner)).toBe(false);
  });

  it('lets a customer reach only their own record', () => {
    expect(() => assertOwner(owner, 'owner_1')).not.toThrow();
    expect(() => assertOwner(owner, 'someone_else')).toThrow();
  });

  it('hides another customer record behind 404, not 403', () => {
    const err = (() => {
      try {
        assertOwner(other, 'owner_1');
      } catch (e) {
        return e;
      }
    })();
    expect((err as AppError).status).toBe(404);
  });

  it('does NOT let a staff role stand in for the owner', () => {
    /*
     * The regression this file exists to hold. These helpers back the
     * customer-scoped routers, so a staff bypass here handed any staff account
     * a stranger's order detail and their identity documents without the admin
     * module's permission checks or access auditing. Staff go through
     * /v1/admin.
     */
    expect(() => assertOwner(actor(Role.STAFF), 'owner_1')).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => assertOwner(actor(Role.ADMIN), 'owner_1')).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(() =>
      assertFound({ userId: 'owner_1' }, actor(Role.STAFF), (r) => r.userId),
    ).toThrowError(expect.objectContaining({ status: 404 }));
  });

  it('assertFound rejects a missing record with 404', () => {
    expect(() => assertFound(null, owner, () => 'owner_1')).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('assertFound returns the record for its owner', () => {
    const record = { id: 'c_1', userId: 'owner_1' };
    expect(assertFound(record, owner, (r) => r.userId)).toBe(record);
  });
});
