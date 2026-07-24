import { useEffect, useState } from 'react';

/*
 * Returns `value` after it has stopped changing for `delayMs`. Used to debounce
 * the orders search box so a query fires once the customer pauses typing rather
 * than on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
