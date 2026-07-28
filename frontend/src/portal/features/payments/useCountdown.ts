import { useEffect, useState } from 'react';

/*
 * The payment window's countdown.
 *
 * It lives here rather than inside the panel because it is not only a display:
 * running out is one of the two ways the checkout screen lets the customer go
 * (the other is cancelling the transfer), so the page and the panel have to read
 * the same clock.
 *
 * Time, not money — AGENTS.md's integer rule is about amounts, and ordinary
 * arithmetic on milliseconds is fine.
 */

export function useCountdown(expiresAt: string | undefined): number {
  const target = expiresAt ? new Date(expiresAt).getTime() : null;

  const [remaining, setRemaining] = useState(() =>
    target === null ? 0 : target - Date.now(),
  );

  useEffect(() => {
    if (target === null) {
      setRemaining(0);
      return;
    }

    // Re-read immediately as well as on the tick: a tab that was backgrounded
    // for ten minutes must not come back showing the value it was left on.
    setRemaining(target - Date.now());

    const tick = window.setInterval(() => {
      setRemaining(target - Date.now());
    }, 1_000);

    return () => window.clearInterval(tick);
  }, [target]);

  return remaining;
}

// "12:45" — a plain mm:ss readout, floored at zero.
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
