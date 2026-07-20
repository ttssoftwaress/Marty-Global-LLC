// Remembers that an account was created on this device, so a logged-out visitor
// who clicks "Get Started" is routed to /login instead of /signup. This is a UX
// convenience only — not auth state and never trusted for access. The real
// boundary is the backend session (AGENTS.md "Auth"). Alongside the flag we
// remember the account name purely to greet the returning visitor by name on the
// login page.

const DEVICE_ACCOUNT_KEY = 'marty.hasAccount';
const DEVICE_ACCOUNT_NAME_KEY = 'marty.accountName';

export function markAccountOnDevice(name?: string): void {
  try {
    localStorage.setItem(DEVICE_ACCOUNT_KEY, '1');
    const trimmed = name?.trim();
    if (trimmed) {
      localStorage.setItem(DEVICE_ACCOUNT_NAME_KEY, trimmed);
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
    return localStorage.getItem(DEVICE_ACCOUNT_NAME_KEY);
  } catch {
    return null;
  }
}
