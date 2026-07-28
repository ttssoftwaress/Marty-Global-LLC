/*
 * Remembers that an account was created on this device, so a logged-out visitor
 * who clicks "Get Started" is routed to /login instead of /signup. This is a UX
 * convenience only — not auth state and never trusted for access. The real
 * boundary is the backend session (AGENTS.md "Auth").
 *
 * The two values are stored differently on purpose. The flag is anonymous, so it
 * persists; the account holder's NAME is personal data, so it lives in
 * sessionStorage and dies with the tab. That still greets someone who logs out
 * and back in, while a later user of a shared or public browser is never shown
 * the previous person's name (AGENTS.md "Security & PII").
 */

const DEVICE_ACCOUNT_KEY = 'marty.hasAccount';
const DEVICE_ACCOUNT_NAME_KEY = 'marty.accountName';

export function markAccountOnDevice(name?: string): void {
  try {
    localStorage.setItem(DEVICE_ACCOUNT_KEY, '1');
    const trimmed = name?.trim();
    if (trimmed) {
      sessionStorage.setItem(DEVICE_ACCOUNT_NAME_KEY, trimmed);
    }
  } catch {
    // Private mode or storage disabled — the flow still works, we just fall
    // back to sending the visitor to /signup.
  }
}

export function deviceHasAccount(): boolean {
  try {
    return localStorage.getItem(DEVICE_ACCOUNT_KEY) === '1';
  } catch {
    return false;
  }
}

export function deviceAccountName(): string | null {
  try {
    // Earlier builds persisted the name; drop anything they left behind so a
    // shared browser stops surfacing it.
    localStorage.removeItem(DEVICE_ACCOUNT_NAME_KEY);
    return sessionStorage.getItem(DEVICE_ACCOUNT_NAME_KEY);
  } catch {
    return null;
  }
}
