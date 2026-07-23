import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../lib/app-error.js';
import { Role } from '../lib/roles.js';
import type { AuthContext } from './auth-context.js';
import { getAuth } from './auth-context.js';
import {
  assertCanMutate,
  assertFound,
  assertOwner,
  canAccess,
  isStaff,
} from './ownership.js';
import { requireIdempotencyKey } from './require-idempotency-key.js';
import { requireAdmin, requireRole, requireStaff } from './require-role.js';
import { requireVerifiedEmail } from './require-verified-email.js';

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
    expect(canAccess(owner, 'owner_1')).toBe(true);
    expect(canAccess(owner, 'someone_else')).toBe(false);
  });

  it('lets staff reach any customer record', () => {
    expect(canAccess(actor(Role.STAFF), 'owner_1')).toBe(true);
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

  it('assertCanMutate allows the owner and staff', () => {
    expect(() => assertCanMutate(owner, 'owner_1')).not.toThrow();
    expect(() => assertCanMutate(actor(Role.STAFF), 'owner_1')).not.toThrow();
    expect(() => assertCanMutate(other, 'owner_1')).toThrow();
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
