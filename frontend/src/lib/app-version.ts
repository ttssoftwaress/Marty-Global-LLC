import type { createBrowserRouter } from 'react-router-dom';

/*
 * Picks up a release without anyone refreshing.
 *
 * lib/stale-deploy.ts and public/boot-recovery.js both handle the moment a tab
 * has ALREADY hit a chunk the new deployment replaced — by then the customer has
 * seen something break. This watcher is the half that gets in front of it: the
 * build id is stamped into the bundle and published beside it as /version.json
 * (vite.config.ts), so a tab can notice a newer build exists and swap itself
 * onto it before it ever asks for a file that is gone.
 *
 * It reloads on the next navigation rather than immediately. A navigation
 * throws the current screen away regardless, so a full document load there is
 * invisible; reloading under someone mid-form would discard what they typed,
 * which is a worse thing to do than showing them yesterday's build for another
 * minute.
 */

const VERSION_URL = '/version.json';
const POLL_MS = 5 * 60 * 1000;

type Router = ReturnType<typeof createBrowserRouter>;

async function deployedBuildId(): Promise<string | null> {
  try {
    const response = await fetch(VERSION_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const build = (body as { build?: unknown }).build;
    return typeof build === 'string' ? build : null;
  } catch {
    // Offline, or the poll raced a deploy. Nothing to do — the next one decides.
    return null;
  }
}

export function installVersionWatcher(router: Router): void {
  // In dev the module graph is served from memory and never goes stale, and
  // there is no version.json to read.
  if (import.meta.env.DEV) return;

  let updatePending = false;

  const check = async () => {
    if (updatePending) return;
    const deployed = await deployedBuildId();
    if (deployed && deployed !== __BUILD_ID__) updatePending = true;
  };

  window.setInterval(() => void check(), POLL_MS);

  // A tab someone comes back to after a day is the one most likely to be
  // holding a bundle that no longer exists.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });

  router.subscribe((state) => {
    if (!updatePending || state.navigation.state !== 'idle') return;
    updatePending = false;
    // The router has already put the destination in the address bar, so this
    // loads the new build straight onto the page the user asked for.
    window.location.reload();
  });
}
