import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '../guards/auth-context.js';
import { Role } from '../lib/roles.js';
import {
  consume,
  createRateLimiter,
  identityKey,
  type CounterClient,
} from './socket-rate-limit.js';

/*
 * Socket rate limiting, in the two layers it is built from.
 *
 * express-rate-limit cannot do this job — that guard is keyed on an HTTP
 * request, and a socket is one request carrying thousands of messages — so this
 * is the only thing standing between a connected client and an unbounded write
 * loop. The part that matters most is that the DURABLE quota is keyed by who is
 * sending and where, not by the connection: a per-connection counter is reset by
 * a reconnect, which is exactly how the budget would be evaded.
 */

describe('the per-connection burst guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to the limit and refuses the next', () => {
    const limiter = createRateLimiter(3);

    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
  });

  // A sliding window, not a fixed one: the budget returns as individual sends age
  // out, so a client that paces itself is never blocked at an arbitrary boundary.
  it('lets the budget return as the window slides', () => {
    const limiter = createRateLimiter(2);

    expect(limiter.allow()).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);

    // 31s later the first send has aged out of the 60s window; the second has not.
    vi.advanceTimersByTime(31_000);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
  });

  it('reports when the caller may try again', () => {
    const limiter = createRateLimiter(1);

    limiter.allow();
    vi.advanceTimersByTime(20_000);

    // 40s of the window remain.
    expect(limiter.retryAfterSeconds()).toBe(40);
  });

  it('reports nothing to wait for when the window is empty', () => {
    expect(createRateLimiter(5).retryAfterSeconds()).toBe(0);
  });

  /*
   * Each connection gets its own guard, which is why it is only a burst floor:
   * one noisy client cannot spend another's, and equally a reconnect hands the
   * same client a fresh one. The durable quota below is what closes that.
   */
  it('keeps connections independent', () => {
    const first = createRateLimiter(1);
    const second = createRateLimiter(1);

    expect(first.allow()).toBe(true);
    expect(first.allow()).toBe(false);
    expect(second.allow()).toBe(true);
  });
});

// A stand-in for the counter commands this module uses, so the shared-quota
// arithmetic is pinned down without a Redis to talk to.
function fakeRedis(): CounterClient & { counters: Map<string, number>; ttls: Map<string, number> } {
  const counters = new Map<string, number>();
  const ttls = new Map<string, number>();

  return {
    counters,
    ttls,
    incr: (key) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return Promise.resolve(next);
    },
    pexpire: (key, ms) => {
      ttls.set(key, ms);
      return Promise.resolve(1);
    },
    pttl: (key) => Promise.resolve(ttls.get(key) ?? -1),
  };
}

const auth: AuthContext = {
  userId: 'u1',
  role: Role.CUSTOMER,
  sessionId: 's1',
  email: 'customer@example.com',
  emailVerified: true,
};

describe('the shared quota', () => {
  it('counts a key up to its limit and then refuses', async () => {
    const redis = fakeRedis();

    expect((await consume('rl:socket-message:user:a:c1', 2, redis)).allowed).toBe(true);
    expect((await consume('rl:socket-message:user:a:c1', 2, redis)).allowed).toBe(true);

    const refused = await consume('rl:socket-message:user:a:c1', 2, redis);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(60);
  });

  // The whole point: the key is the actor and the conversation, so a second
  // connection from the same person shares one budget.
  it('shares one budget across connections for the same key', async () => {
    const redis = fakeRedis();
    const key = `rl:socket-message:${identityKey({ kind: 'user', auth })}:c1`;

    expect((await consume(key, 1, redis)).allowed).toBe(true);
    // Same actor, same thread, a brand-new socket — still over budget.
    expect((await consume(key, 1, redis)).allowed).toBe(false);
  });

  it('keeps separate conversations on separate budgets', async () => {
    const redis = fakeRedis();

    expect((await consume('rl:socket-message:user:a:c1', 1, redis)).allowed).toBe(true);
    expect((await consume('rl:socket-message:user:a:c2', 1, redis)).allowed).toBe(true);
  });

  /*
   * Fail OPEN, like the REST store: a limiter is a guard, not a dependency, and
   * a Redis outage that silenced live chat would be the worse failure.
   */
  it('allows the event when the counter store is unreachable', async () => {
    const broken: CounterClient = {
      incr: () => Promise.reject(new Error('ECONNREFUSED')),
      pexpire: () => Promise.resolve(1),
      pttl: () => Promise.resolve(-1),
    };

    expect((await consume('rl:socket-message:user:a:c1', 1, broken)).allowed).toBe(true);
  });

  /*
   * A counter with no expiry would lock the actor out of chat for good, so a
   * missing TTL is repaired rather than trusted.
   */
  it('restores a missing expiry instead of blocking forever', async () => {
    const redis = fakeRedis();

    await consume('rl:socket-message:user:a:c1', 1, redis);
    redis.ttls.delete('rl:socket-message:user:a:c1');

    const refused = await consume('rl:socket-message:user:a:c1', 1, redis);
    expect(refused.allowed).toBe(false);
    expect(redis.ttls.get('rl:socket-message:user:a:c1')).toBe(60_000);
  });

  it('keys a guest by their chat record, which a reconnect does not reset', () => {
    expect(
      identityKey({
        kind: 'guest',
        guest: { id: 'g1', name: 'V', email: 'v@example.com', conversationId: 'c1' },
      }),
    ).toBe('guest:g1');
  });
});
