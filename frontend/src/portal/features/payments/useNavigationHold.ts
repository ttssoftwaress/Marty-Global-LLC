import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router-dom';

/*
 * Hold the customer on the page while a payment window is open.
 *
 * An abandoned USDT window is not harmless: the deposit address is still being
 * watched for one exact amount, and a customer who wandered off mid-countdown
 * can send that amount to a screen they can no longer see. So while the window
 * is open the checkout screen refuses to be left silently — every exit has to be
 * answered, and cancelling the transfer is the one that actually closes it.
 *
 * Three exits, three mechanisms:
 *
 *   · In-app navigation (a sidebar link, the back button) — the router blocker
 *     catches it and the page asks.
 *   · A reload or a tab close — outside the router entirely, so the browser's
 *     own prompt is the only thing that can ask. Answering "leave" is now safe:
 *     the window lives in the database and the page resumes it on the way back.
 *   · The page navigating away on purpose, once the transfer is cancelled —
 *     `release()`, which drops the hold synchronously so the guard does not
 *     block the exit it just approved.
 *
 * The blocker reads a ref rather than closing over `active` so it registers once
 * and always sees the current answer. Re-registering it on every tick of the
 * countdown would be a lot of churn for a value that changes twice.
 */
export function useNavigationHold(active: boolean): {
  blocker: Blocker;
  release: () => void;
} {
  const holdRef = useRef(active);
  holdRef.current = active;

  const blocker = useBlocker(
    useCallback(
      // Same-route navigation is not an exit, and prompting for one would be a
      // dialog the customer cannot make sense of.
      ({ currentLocation, nextLocation }) =>
        holdRef.current && currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  );

  /*
   * The hold can lift while a navigation is sitting blocked — the countdown runs
   * out mid-question. Standing the blocker down then clears the prompt rather
   * than leaving a dead-end dialog about a window that has already closed; the
   * page is free now, so the next click just works.
   */
  const resetBlocker = blocker.state === 'blocked' ? blocker.reset : undefined;

  useEffect(() => {
    if (!active && resetBlocker) resetBlocker();
  }, [active, resetBlocker]);

  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // The message is the browser's own — no page can set it any more. Calling
      // both is what makes the prompt appear across browsers.
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  const release = useCallback(() => {
    holdRef.current = false;
  }, []);

  return { blocker, release };
}
