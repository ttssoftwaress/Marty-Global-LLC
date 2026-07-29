import { useLayoutEffect } from 'react';

/*
 * Compact density for the product surfaces. The portal, admin, and auth shells
 * call this; marketing never does. It tags <html> with `app-compact`, which
 * drops the root font-size to 80% (styles/index.css) — the whole design system
 * is rem-based, so every screen scales uniformly, matching what the design
 * looked like at 80% browser zoom.
 *
 * The class lives on <html> (not the shell's own root) so anything rendered
 * outside the shell subtree — portaled dialogs, toasts — scales with it.
 *
 * A plain counter handles overlap: during a route transition two shells can be
 * mounted for a frame, and unmount must not strip the class the incoming shell
 * still needs.
 */
let holders = 0;

export function useCompactScale() {
  useLayoutEffect(() => {
    holders += 1;
    document.documentElement.classList.add('app-compact');
    return () => {
      holders -= 1;
      if (holders === 0) {
        document.documentElement.classList.remove('app-compact');
      }
    };
  }, []);
}
