/*
 * A hint that this device had a live session the last time a guard looked. It is
 * NOT auth state and is never trusted for access — the backend session is the
 * real boundary (AGENTS.md "Auth"), exactly like `device-account.ts`.
 *
 * Its only job is to decide what a public route renders during the one round
 * trip while Better Auth's session check is in flight:
 *
 * - hint set    → hold the render, so a logged-in visitor never flashes the
 *                 marketing site or an auth screen before being redirected into
 *                 their portal.
 * - hint absent → render straight away, so an anonymous visitor (and a crawler)
 *                 never waits on a blank page for a request that comes back
 *                 empty. Marketing is the public front door; blanking it on
 *                 every first paint to catch the rarer logged-in case is the
 *                 wrong trade.
 *
 * The flag is anonymous — no id, no name, nothing about who the session belongs
 * to (AGENTS.md "Security & PII").
 */

const SESSION_HINT_KEY = 'marty.session';

export function markSessionHint(): void {
  try {
    localStorage.setItem(SESSION_HINT_KEY, '1');
  } catch {
    // Private mode or storage disabled — the guards still work, a logged-in
    // visitor just gets the brief render they would have had without the hint.
  }
}

export function clearSessionHint(): void {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Same as above — the hint is an optimisation, never a gate.
  }
}

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}
