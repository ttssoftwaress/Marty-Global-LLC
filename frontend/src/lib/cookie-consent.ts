/*
 * Cookie consent — the visitor's choice about non-essential storage.
 *
 * The footer links "Cookie Settings" at a page that has to actually set
 * something, so this is the one place the preference lives. It is deliberately
 * small and dependency-free (localStorage, same as `device-account.ts`) rather
 * than a consent-management library — the budget in AGENTS.md is closed.
 *
 * The categories mirror what the stack can switch off. Essential covers the
 * Better Auth session and the Turnstile challenge and is not optional: without
 * it nobody can sign in, so it is stated, not offered. Analytics gates PostHog,
 * which AGENTS.md requires to load only after consent on marketing pages.
 *
 * Denied is the default. Until a visitor makes a choice, `analytics` reads
 * false, so nothing non-essential may load on a first visit.
 */

const CONSENT_KEY = 'marty.cookieConsent';
const CONSENT_VERSION = 1;

export type CookieConsent = {
  version: number;
  analytics: boolean;
  /** ISO-8601 UTC instant the choice was recorded. */
  decidedAt: string;
};

const DENIED: CookieConsent = {
  version: CONSENT_VERSION,
  analytics: false,
  decidedAt: '',
};

/*
 * Subscribers so a preference saved on the cookie page updates anything else
 * listening in the same tab. `storage` covers other tabs; it does not fire in
 * the tab that wrote, which is why both paths exist.
 */
const listeners = new Set<(consent: CookieConsent) => void>();

export function readCookieConsent(): CookieConsent {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return DENIED;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DENIED;

    const stored = parsed as Partial<CookieConsent>;
    // A bumped version means the categories changed, so the old answer no
    // longer covers what we would be asking about — re-ask rather than assume.
    if (stored.version !== CONSENT_VERSION) return DENIED;

    return {
      version: CONSENT_VERSION,
      analytics: stored.analytics === true,
      decidedAt: typeof stored.decidedAt === 'string' ? stored.decidedAt : '',
    };
  } catch {
    return DENIED;
  }
}

export function writeCookieConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    analytics,
    decidedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // Private mode or storage disabled. The choice cannot be remembered, so the
    // visitor stays on the safe default — nothing non-essential loads.
  }

  listeners.forEach((listener) => listener(consent));
  return consent;
}

/** Whether the visitor has answered at all — an unanswered visitor is not a "no". */
export function hasDecidedCookieConsent(): boolean {
  return readCookieConsent().decidedAt !== '';
}

export function subscribeToCookieConsent(
  listener: (consent: CookieConsent) => void,
): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY) listener(readCookieConsent());
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
