import { useEffect, useState } from 'react';

/*
 * Returns `value` after it has stopped changing for `delayMs`. Used to debounce
 * the orders-queue search box so a query fires once the admin pauses typing
 * rather than on every keystroke.
 *
 * Mirrors the portal's hook of the same name; the two areas never import from
 * each other (AGENTS.md, route-group rule), so each keeps its own copy.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
