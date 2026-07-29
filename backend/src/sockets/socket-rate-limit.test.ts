import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRateLimiter } from './socket-rate-limit.js';

/*
 * The socket message limiter.
 *
 * It exists because express-rate-limit cannot do this job — that guard is keyed
 * on an HTTP request, and a socket is one request carrying thousands of
 * messages. So this is the only thing standing between a connected client and an
 * unbounded write loop, which makes its window arithmetic worth pinning down.
 */

describe('the per-connection rate limiter', () => {
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
   * Each connection gets its own limiter, so one noisy client cannot spend
   * another's budget. The alternative — a shared map keyed by user — would also
   * need eviction; this state simply dies with the socket.
   */
  it('keeps connections independent', () => {
    const first = createRateLimiter(1);
    const second = createRateLimiter(1);

    expect(first.allow()).toBe(true);
    expect(first.allow()).toBe(false);
    expect(second.allow()).toBe(true);
  });
});
