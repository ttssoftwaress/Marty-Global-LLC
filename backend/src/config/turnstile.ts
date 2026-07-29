import { env } from './env.js';
import { fetchWithTimeout, isTimeoutError } from '../lib/http.js';
import { logger } from '../lib/logger.js';

/*
 * Cloudflare Turnstile verification.
 *
 * Called server-side only (AGENTS.md: the browser never talks to a third party
 * directly) from the one endpoint an unauthenticated visitor can write to — the
 * anonymous chat. Everything else on this backend sits behind a session.
 *
 * Follows the same posture as SES and R2: absent credentials mean the feature
 * degrades rather than crashes, so local dev and the test suite run without a
 * Cloudflare account. The difference is that this degradation is a security
 * one, so it warns every time instead of failing silently.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/*
 * This call sits in the request path of a public, unauthenticated endpoint, and
 * `fetch` has no default timeout — a Cloudflare edge that accepts the connection
 * and then stops answering would pin one of our request handlers per visitor
 * until the socket died. Short, because a human is waiting on the other end of
 * it, and the failure path is already correct: a timeout rejects, the catch
 * below fails closed, and the visitor is asked to try again.
 */
const TURNSTILE_TIMEOUT_MS = 5_000;

export const turnstileEnabled = Boolean(env.TURNSTILE_SECRET_KEY);

// Cloudflare's response; we read only the verdict. `error-codes` is logged on
// failure because it distinguishes a bad key (our problem) from a failed
// challenge (theirs).
type SiteVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  if (!turnstileEnabled) {
    logger.warn(
      'TURNSTILE_SECRET_KEY is not set — public chat is accepting unverified visitors',
    );
    return true;
  }

  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY as string,
      response: token,
    });
    if (remoteIp) body.set('remoteip', remoteIp);

    const response = await fetchWithTimeout(
      VERIFY_URL,
      { method: 'POST', body },
      TURNSTILE_TIMEOUT_MS,
    );

    if (!response.ok) {
      logger.error({ status: response.status }, 'Turnstile verification unreachable');
      // Fail closed. An outage at Cloudflare is not a reason to open the only
      // unauthenticated write endpoint we have.
      return false;
    }

    const result = (await response.json()) as SiteVerifyResponse;

    if (!result.success) {
      logger.warn({ errorCodes: result['error-codes'] }, 'Turnstile challenge failed');
    }

    return result.success;
  } catch (error) {
    // Fail closed here too — a timeout is an unanswered challenge, not a passed
    // one.
    logger.error(
      { err: error, timedOut: isTimeoutError(error) },
      'Turnstile verification failed',
    );
    return false;
  }
}
