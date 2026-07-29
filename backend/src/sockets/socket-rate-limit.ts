import { env } from '../config/env.js';

/*
 * Per-connection rate limiting for inbound socket events.
 *
 * express-rate-limit cannot do this job: it is Express middleware keyed on an
 * HTTP request, and a socket is one request that then carries thousands of
 * messages. So this is the socket-side equivalent of `chatRateLimit`, with the
 * same budget and the same intent (AGENTS.md — inbound messages are rate-limited
 * per connection, the same posture as public endpoints).
 *
 * A sliding window rather than a token bucket: the limit customers and agents
 * actually notice is "how many can I send in a minute", and a window says
 * exactly that. State lives on the connection and dies with it, so there is
 * nothing to evict and no shared map to leak.
 */

const WINDOW_MS = 60_000;

export type RateLimiter = {
  // False means the caller is over budget and the event must be dropped.
  allow: () => boolean;
  retryAfterSeconds: () => number;
};

export function createRateLimiter(limit: number): RateLimiter {
  // Send timestamps inside the current window, oldest first.
  let hits: number[] = [];

  return {
    allow() {
      const now = Date.now();
      hits = hits.filter((at) => now - at < WINDOW_MS);

      if (hits.length >= limit) return false;

      hits.push(now);
      return true;
    },
    retryAfterSeconds() {
      const oldest = hits[0];
      if (oldest === undefined) return 0;
      return Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - oldest)) / 1000));
    },
  };
}

// Messages are the expensive event — each one is a write plus a broadcast.
export function createMessageLimiter(): RateLimiter {
  return createRateLimiter(env.SUPPORT_SOCKET_MESSAGES_PER_MINUTE);
}

/*
 * Typing notifications are cheap but chatty — a keystroke-driven client could
 * emit one per character. This is generous enough that a fast typist never
 * notices and tight enough that the event cannot be used as a flood channel.
 * The client also throttles; this is the boundary that actually holds.
 */
export function createTypingLimiter(): RateLimiter {
  return createRateLimiter(120);
}
