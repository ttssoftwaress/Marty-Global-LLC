import type {
  AdminCarrier,
  AdminLocation,
  CarrierCreatePayload,
  CarrierDraft,
  CarrierUpdatePayload,
  LocationCreatePayload,
  LocationDraft,
  LocationUpdatePayload,
  SettingsFormErrors,
} from '../types/settings';

/*
 * Draft ↔ payload plumbing for the two settings forms, plus the small
 * derivations that make each one a single-field action to fill in.
 *
 * The validation here mirrors the backend's Zod schemas. It exists to say what
 * is wrong beside the input rather than after a round trip — the server refuses
 * the same things, and it is the one that decides (AGENTS.md: business logic
 * lives in services).
 */

// --- Locations -----------------------------------------------------------

/*
 * A location code guessed from its name: the initials of a multi-word name
 * ("United States" → "US", "European Union" → "EU"), or the first two letters of
 * a single-word one ("Singapore" → "SI", which the admin then corrects to "SG").
 *
 * A guess, not an answer — the field stays editable, and it only ever fills in
 * while the code box is untouched. Most of the list is two-word country names,
 * so it is right more often than not and costs nothing when it isn't.
 */
export function deriveLocationCode(label: string): string {
  const words = label
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) return '';

  if (words.length === 1) return (words[0] ?? '').slice(0, 2);

  return words
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 12);
}

/*
 * The flag emoji for a two-letter code, from the Unicode regional indicator
 * block (U+1F1E6 is "A"). The backend derives the same thing on write; this is
 * the form's live preview of what it will store.
 */
export function flagForCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '';

  return String.fromCodePoint(
    ...[...upper].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export const newLocationDraft = (): LocationDraft => ({
  code: '',
  label: '',
  flag: '',
  active: true,
});

export const draftFromLocation = (location: AdminLocation): LocationDraft => ({
  code: location.code,
  label: location.label,
  flag: location.flag,
  active: location.active,
});

export function validateLocationDraft(draft: LocationDraft): SettingsFormErrors {
  const errors: SettingsFormErrors = {};

  if (!draft.label.trim()) errors.label = 'Name this location.';

  const code = draft.code.trim().toUpperCase() || deriveLocationCode(draft.label);
  if (!code) {
    errors.code = 'A location code is required.';
  } else if (!/^[A-Z][A-Z0-9-]{1,11}$/.test(code)) {
    errors.code =
      'Use 2–12 characters — letters, digits or hyphens, starting with a letter.';
  }

  return errors;
}

export function locationCreatePayload(
  draft: LocationDraft,
): LocationCreatePayload {
  const code = draft.code.trim().toUpperCase() || deriveLocationCode(draft.label);

  return {
    code,
    label: draft.label.trim(),
    // Sent only when typed. Blank lets the backend derive the flag from the
    // code, which is the common case for a country.
    ...(draft.flag.trim() ? { flag: draft.flag.trim() } : {}),
    active: draft.active,
  };
}

export const locationUpdatePayload = (
  draft: LocationDraft,
): LocationUpdatePayload => ({
  label: draft.label.trim(),
  flag: draft.flag.trim(),
  active: draft.active,
});

// --- Carriers ------------------------------------------------------------

// Lower-case kebab, deliberately unlike a location's upper-case code so a value
// from one list is never pasted into the other by mistake.
export function deriveCarrierCode(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+$/g, '')
    .slice(0, 32);
}

export const newCarrierDraft = (): CarrierDraft => ({
  code: '',
  label: '',
  active: true,
});

export const draftFromCarrier = (carrier: AdminCarrier): CarrierDraft => ({
  code: carrier.code,
  label: carrier.label,
  active: carrier.active,
});

export function validateCarrierDraft(draft: CarrierDraft): SettingsFormErrors {
  const errors: SettingsFormErrors = {};

  if (!draft.label.trim()) errors.label = 'Name this carrier.';

  const code = draft.code.trim().toLowerCase() || deriveCarrierCode(draft.label);
  if (!code) {
    errors.code = 'A carrier code is required.';
  } else if (!/^[a-z][a-z0-9-]{1,31}$/.test(code)) {
    errors.code =
      'Use lower-case letters, digits and hyphens, starting with a letter.';
  }

  return errors;
}

export const carrierCreatePayload = (draft: CarrierDraft): CarrierCreatePayload => ({
  code: draft.code.trim().toLowerCase() || deriveCarrierCode(draft.label),
  label: draft.label.trim(),
  active: draft.active,
});

export const carrierUpdatePayload = (draft: CarrierDraft): CarrierUpdatePayload => ({
  label: draft.label.trim(),
  active: draft.active,
});

// --- Shared --------------------------------------------------------------

/*
 * The "Used by" line. Reads as a sentence rather than a set of counters, because
 * what the admin is deciding is whether an edit here is safe — "3 services · 12
 * orders" answers that, a bare number does not.
 */
export function formatLocationUsage(location: AdminLocation): string {
  const parts: string[] = [];

  const { services, pricingTiers, orders } = location.usage;
  if (services > 0) parts.push(`${services} service${services === 1 ? '' : 's'}`);
  if (pricingTiers > 0) {
    parts.push(`${pricingTiers} price point${pricingTiers === 1 ? '' : 's'}`);
  }
  if (orders > 0) parts.push(`${orders} order${orders === 1 ? '' : 's'}`);

  return parts.length > 0 ? parts.join(' · ') : 'Not used yet';
}

export function formatCarrierUsage(carrier: AdminCarrier): string {
  const { shipments } = carrier.usage;
  if (shipments === 0) return 'Not used yet';
  return `${shipments} shipment${shipments === 1 ? '' : 's'}`;
}

/*
 * Move an item one place in either direction, returning the new order. The list
 * is submitted whole, so this is the only reordering primitive either panel
 * needs; an out-of-range move is a no-op rather than an error.
 */
export function moveInList<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }

  const next = [...items];
  // Splice always returns the removed element for an in-range index, which the
  // index signature can't express under `noUncheckedIndexedAccess`.
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
