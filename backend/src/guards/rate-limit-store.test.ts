import { describe, expect, it } from 'vitest';

import { storeFailureOptions } from './rate-limit-store.js';

/*
 * The shared limiter options.
 *
 * `createRateLimitStore` itself returns undefined under test (no Redis in the
 * suite), so what is worth pinning here is the posture: a Redis outage must not
 * take the API down with it, and it must not go unnoticed either.
 */

describe('rate limit store options', () => {
  /*
   * The decision from rate-limit-store.ts: a limiter is a guard, not a
   * dependency. If this ever flips to false, a Redis blip turns every rate
   * limited route — which is all of them — into a 500.
   */
  it('fails open when the store errors', () => {
    expect(storeFailureOptions.passOnStoreError).toBe(true);
  });

  /*
   * Failing open silently would remove the protection with nothing in the logs
   * to say so. The library defaults to console, which AGENTS.md forbids in
   * committed code, so the logger is routed into pino — these assert the shape
   * express-rate-limit calls (error, message?) survives.
   */
  it('routes store failures into the logger rather than console', () => {
    expect(typeof storeFailureOptions.logger.error).toBe('function');
    expect(typeof storeFailureOptions.logger.warn).toBe('function');

    expect(() =>
      storeFailureOptions.logger.error(new Error('redis down'), 'increment failed'),
    ).not.toThrow();
    // The message is optional in express-rate-limit's Logger contract.
    expect(() => storeFailureOptions.logger.warn(new Error('redis slow'))).not.toThrow();
  });
});
