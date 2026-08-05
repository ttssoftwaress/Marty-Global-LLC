/*
 * Recovery from a stale deploy.
 *
 * Every route in the app is a dynamic import, so the browser fetches a
 * content-hashed chunk (`/assets/HomePage-<hash>.js`) the moment someone
 * navigates. A release rewrites those hashes, and Cloudflare Pages serves only
 * the files belonging to the current deployment — a tab that has been open
 * across a deploy still holds the previous `index.html` and asks for a chunk
 * that no longer exists. The SPA fallback in `public/_redirects` answers that
 * request with `index.html`, so the browser gets HTML where it expected a
 * module and throws:
 *
 *   Failed to fetch dynamically imported module: .../assets/HomePage-<hash>.js
 *
 * Nothing is broken — the tab is simply running the wrong build. `index.html`
 * is served `no-cache`, so a reload picks up the new document and its new
 * hashes. Vite raises `vite:preloadError` for exactly this failure, which is
 * the only hook that fires before React Router turns it into an error screen.
 *
 * The reload happens at most once per tab. A bundle that is genuinely broken
 * (a chunk cached as HTML at the edge, say) would otherwise reload forever, and
 * a reload loop is a worse failure than the error screen — the second time
 * through, the user sees the fallback and can decide for themselves.
 */

const RELOAD_KEY = 'marty:stale-deploy-reload';

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === '1';
  } catch {
    // Private-mode Safari throws on sessionStorage. Treat it as "already
    // reloaded" rather than risk the loop this flag exists to prevent.
    return true;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    /* see above */
  }
}

/** True for the module-fetch failure a stale deploy produces. */
export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    /dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

export function installStaleDeployReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (alreadyReloaded()) return;
    markReloaded();
    // Stops Vite from rethrowing, so the router never renders an error screen
    // for a page we are about to reload out from under it.
    event.preventDefault();
    window.location.reload();
  });
}

/** Reload once from an error screen the listener above did not get to first. */
export function reloadForStaleDeploy(): boolean {
  if (alreadyReloaded()) return false;
  markReloaded();
  window.location.reload();
  return true;
}
