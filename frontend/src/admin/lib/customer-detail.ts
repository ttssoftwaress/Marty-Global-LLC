import { format, parseISO } from 'date-fns';

/*
 * The customer-detail header's "Customer since Jan 2026" phrase.
 *
 * The stored value is the account's creation timestamp (ISO-8601 UTC, AGENTS.md
 * Dates); `parseISO` converts to the viewer's zone, which is the only place that
 * conversion happens. An account with no recorded start renders nothing rather
 * than a dangling "Customer since".
 */

export function formatCustomerSince(iso: string | null): string | null {
  if (!iso) return null;
  return `Customer since ${format(parseISO(iso), 'MMM yyyy')}`;
}
