import { ipKeyGenerator } from 'express-rate-limit';
import type { Socket } from 'socket.io';

import { env } from '../config/env.js';
import { rateLimitRedis } from '../config/redis.js';
import { logger } from '../lib/logger.js';
import type { SocketIdentity } from './access.js';

/*
 * Rate limiting for inbound socket events.
 *
 * express-rate-limit cannot do this job: it is Express middleware keyed on an
 * HTTP request, and a socket is one request that then carries thousands of
 * messages. So this file is the socket-side equivalent of `chatRateLimit`
 * (guards/rate-limit.ts), and it is built in the two layers AGENTS.md asks for:
 *
 *   1. A DURABLE quota keyed by the actor and the conversation, counted in the
 *      same Redis the REST limiters use. This is "the limit". A client can open
 *      several authenticated sockets, so anything that lives on a connection is
 *      reset by a reconnect — which is the one attack the budget has to survive.
 *   2. A per-connection burst guard, kept as an extra floor rather than as the
 *      limit: it costs nothing, needs no round trip, and sheds a flood before it
 *      reaches the parser or Redis.
 *
 * A guest holds a chat token rather than an account, so their durable quota is
 * keyed by the guest record AND by their address — a fresh token would otherwise
 * be a fresh budget, and minting one is only bounded by the public limiter.
 */

const WINDOW_MS = 60_000;
const WINDOW_SECONDS = WINDOW_MS / 1000;

// Typing notifications are cheap but chatty — a keystroke-driven client could
// emit one per character. Generous enough that a fast typist never notices,
// tight enough that the event cannot be used as a flood channel. The client also
// throttles; this is the boundary that actually holds.
const TYPING_PER_MINUTE = 120;

/*
 * A visitor can legitimately hold more than one guest chat behind one address —
 * a second tab, or a fresh token after theirs was purged — so the address floor
 * is a multiple of a single chat's budget rather than equal to it. Otherwise two
 * honest tabs on the same network would spend each other's allowance.
 */
const GUEST_ADDRESS_MULTIPLIER = 3;

// --- Per-connection burst guard --------------------------------------------
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
export function createMessageBurstLimiter(): RateLimiter {
  return createRateLimiter(env.SUPPORT_SOCKET_MESSAGES_PER_MINUTE);
}

export function createTypingBurstLimiter(): RateLimiter {
  return createRateLimiter(TYPING_PER_MINUTE);
}

// --- Durable quota ----------------------------------------------------------
export type QuotaVerdict = { allowed: boolean; retryAfterSeconds: number };

const ALLOWED: QuotaVerdict = { allowed: true, retryAfterSeconds: 0 };

/*
 * The slice of ioredis this file uses, named so a test can hand in a stand-in.
 * A fixed window (INCR + PEXPIRE) rather than the sliding one above: it is the
 * same shape rate-limit-redis uses for the REST limiters, it costs one round
 * trip, and it needs no per-actor list of timestamps living in Redis.
 */
export type CounterClient = {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<unknown>;
  pttl: (key: string) => Promise<number>;
};

/*
 * Count one event against a key.
 *
 * Fails OPEN, exactly like the REST store (guards/rate-limit-store.ts): a
 * limiter is a guard, not a dependency, and turning a Redis blip into "nobody
 * can send a message" is the worse failure. The degradation is logged so it
 * cannot disappear silently.
 */
export async function consume(
  key: string,
  limit: number,
  client: CounterClient = rateLimitRedis,
): Promise<QuotaVerdict> {
  try {
    const hits = await client.incr(key);

    if (hits === 1) {
      await client.pexpire(key, WINDOW_MS);
      return ALLOWED;
    }

    if (hits <= limit) return ALLOWED;

    const ttl = await client.pttl(key);

    /*
     * A negative TTL means the key has no expiry, so the PEXPIRE on the first
     * hit never landed. Restore it: a counter that never resets would lock the
     * actor out of chat permanently, which is a far worse outcome than the extra
     * command.
     */
    if (ttl < 0) {
      await client.pexpire(key, WINDOW_MS);
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }

    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) };
  } catch (error) {
    logger.warn({ err: error, key }, 'Socket rate limit store unavailable');
    return ALLOWED;
  }
}

/*
 * Who is being counted. A user is their account; a guest is the chat record
 * their token resolved to, which is what makes the quota survive the reconnect
 * that a per-connection counter would have forgiven.
 */
export function identityKey(identity: SocketIdentity): string {
  return identity.kind === 'guest'
    ? `guest:${identity.guest.id}`
    : `user:${identity.auth.userId}`;
}

/*
 * The address a socket came from, mirroring what `trust proxy: 1` gives Express
 * (app.ts). Socket.io does not read that setting, so the same rule is applied by
 * hand: exactly ONE hop is trusted, so the RIGHTMOST X-Forwarded-For entry — the
 * one our own proxy appended — is the client. Everything to its left is whatever
 * the caller chose to send and is ignored, or a spoofed header would be a way to
 * mint a fresh budget per message.
 *
 * `ipKeyGenerator` is express-rate-limit's own normaliser, used here for the same
 * reason guards/rate-limit.ts uses it: it collapses IPv6 to a /64 so a single
 * host cannot cycle addresses to reset its own limit.
 */
export function addressKey(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  const header = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  const trusted = header?.split(',').at(-1)?.trim();

  return `ip:${ipKeyGenerator(trusted || socket.handshake.address || '')}`;
}

// Local dev and tests have no Redis and would otherwise log a warning per event.
const countingDisabled = (): boolean => env.NODE_ENV === 'test';

/*
 * The budget for sending into one conversation. Checked after the payload parses
 * (the conversation is part of the key) and before anything touches the database.
 */
export async function checkMessageQuota(
  socket: Socket,
  identity: SocketIdentity,
  conversationId: string,
): Promise<QuotaVerdict> {
  if (countingDisabled()) return ALLOWED;

  const limit = env.SUPPORT_SOCKET_MESSAGES_PER_MINUTE;

  const own = await consume(
    `rl:socket-message:${identityKey(identity)}:${conversationId}`,
    limit,
  );
  if (!own.allowed) return own;

  // A signed-in caller is already counted per account, which no reconnect and no
  // new token resets. Only the guest path needs the address floor underneath it.
  if (identity.kind !== 'guest') return ALLOWED;

  return consume(
    `rl:socket-message:${addressKey(socket)}`,
    limit * GUEST_ADDRESS_MULTIPLIER,
  );
}

/*
 * The same treatment for typing. No address floor: typing is ephemeral and
 * writes nothing, so the identity key — which a reconnect does not reset — is
 * the whole of what the nit here was about.
 */
export async function checkTypingQuota(
  identity: SocketIdentity,
  conversationId: string,
): Promise<QuotaVerdict> {
  if (countingDisabled()) return ALLOWED;

  return consume(
    `rl:socket-typing:${identityKey(identity)}:${conversationId}`,
    TYPING_PER_MINUTE,
  );
}
