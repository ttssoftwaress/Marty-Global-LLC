/*
 * Outbound HTTP with a deadline.
 *
 * `fetch` has no default timeout, so a provider that accepts the connection and
 * then never answers holds the caller forever. That is not hypothetical here:
 * the two callers are the USDT sweep (a hung TronGrid stalls the whole payment
 * poller, and with it every credit behind it) and Turnstile verification (a hung
 * Cloudflare stalls the one public endpoint an unauthenticated visitor can
 * reach). Both would rather fail and be retried than hang.
 *
 * `AbortSignal.timeout` aborts with a `TimeoutError` DOMException, which surfaces
 * to the caller as a rejected fetch — the same shape as a connection failure, so
 * existing catch blocks already handle it.
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Whether a rejected fetch was our own deadline rather than the network. Worth
 * distinguishing in a log line: a timeout is a slow provider, everything else is
 * an unreachable one.
 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}
