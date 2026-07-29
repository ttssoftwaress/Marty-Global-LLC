import { differenceInCalendarDays, parseISO } from 'date-fns';

/*
 * Storage-expiry rule for a scanned mail item. When a physical item's shred date
 * is close, the inbox emphasises it (amber, bold, alert icon) so the customer
 * can request forwarding in time. The threshold is a business rule the backend
 * will ultimately own; the UI mirrors it for the at-a-glance signal.
 */

export const STORAGE_EXPIRY_SOON_DAYS = 7;

export function isStorageExpiringSoon(iso: string): boolean {
  const days = differenceInCalendarDays(parseISO(iso), new Date());
  return days >= 0 && days <= STORAGE_EXPIRY_SOON_DAYS;
}
