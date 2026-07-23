import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

import type { Money } from '../types/dashboard';

/*
 * Render-time formatting for the portal. Money is stored as integer minor
 * units, so the division here is the single place a value becomes a float —
 * for display only, never for arithmetic (AGENTS.md, Money rules).
 */

const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  USDT: 6,
};

export function formatMoney({ amount, currency }: Money) {
  const exponent = MINOR_UNIT_EXPONENT[currency] ?? 2;

  // USDT is not an ISO 4217 code, so Intl cannot resolve it as a currency.
  if (currency === 'USDT') {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: exponent,
    }).format(amount / 10 ** exponent)} USDT`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amount / 10 ** exponent);
}

export function formatOrderDate(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

export function formatRelativeTime(iso: string) {
  return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
}
