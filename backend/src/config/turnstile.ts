import { env } from './env.js';
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

    const response = await fetch(VERIFY_URL, { method: 'POST', body });

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
    logger.error({ err: error }, 'Turnstile verification failed');
    return false;
  }
}
