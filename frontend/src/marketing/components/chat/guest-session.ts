/*
 * The anonymous visitor's identity, as far as the browser is concerned.
 *
 * A single opaque token in localStorage. It is a bearer credential: whoever
 * holds it reaches that conversation, which is acceptable for a thread whose
 * only contents are what the visitor themselves typed, and is why the server
 * stores nothing but its hash.
 *
 * localStorage rather than a cookie for two reasons. It survives the browser
 * closing, which is the whole point — a visitor comes back a day later and picks
 * up where they left off — and it is not attached to any request automatically,
 * so it never travels to endpoints that have no business seeing it.
 *
 * The server purges the conversation once it goes quiet; a token whose thread is
 * gone simply reads as a new visitor, so there is nothing to expire here.
 */

const TOKEN_KEY = 'marty.guest-chat.token';

// Private browsing and some embedded webviews throw on localStorage access
// rather than returning null. The widget must still work — the visitor just
// loses their history when the tab closes.
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readGuestToken(): string | null {
  return safeStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function writeGuestToken(token: string): void {
  try {
    safeStorage()?.setItem(TOKEN_KEY, token);
  } catch {
    // Full or blocked storage. The conversation still works for this tab.
  }
}

export function clearGuestToken(): void {
  try {
    safeStorage()?.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do — the token is already unreachable either way.
  }
}
