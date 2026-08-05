/*
 * Reading an audit entry's metadata.
 *
 * The column is JSON whose shape varies per action by design — a status change,
 * an amount in minor units, a set of permission keys — so the viewer renders it
 * generically rather than typing sixty shapes it would then have to keep in step
 * with the backend by hand.
 *
 * That genericness is the point, not a shortcut: an audited event added next
 * month shows its metadata on this screen with no frontend change, which is the
 * same promise the action labels make.
 *
 * The backend guarantees the column is free of PII and card data (AGENTS.md,
 * Security & PII), so nothing here redacts. What it does do is bound the output
 * — depth, length, and count — because this is the one place a value the backend
 * derived from a request could be long enough to break the layout.
 */

export type AuditMetadataEntry = { key: string; value: string };

// Labels are the metadata's own keys, which are written in the recording layer
// as readable camelCase ("roleFrom", "matchedAccount"). Splitting them beats a
// hand-maintained label map that would silently miss every new key.
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const MAX_VALUE_LENGTH = 120;

function truncate(value: string): string {
  return value.length > MAX_VALUE_LENGTH
    ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
    : value;
}

/*
 * One value as a string.
 *
 * Nested objects are stringified rather than flattened into more rows: the
 * metadata that nests is rare and shallow, and flattening it would produce keys
 * like "permissionsTo.0" that read worse than the JSON they came from.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return truncate(value.length === 0 ? '—' : value);

  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return truncate(value.map((item) => formatValue(item)).join(', '));
  }

  try {
    return truncate(JSON.stringify(value));
  } catch {
    // A cyclic structure cannot reach here through JSON from the wire, but the
    // value is `unknown` and this must not be the thing that breaks the row.
    return '—';
  }
}

/*
 * The rows a detail panel prints for one entry.
 *
 * Capped rather than unbounded. Nothing written today comes close, but the panel
 * must stay readable for whatever a future event records, and a cap that never
 * fires costs nothing.
 */
const MAX_ENTRIES = 24;

export function auditMetadataEntries(metadata: unknown): AuditMetadataEntry[] {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata)
    .slice(0, MAX_ENTRIES)
    .map(([key, value]) => ({ key: humanizeKey(key), value: formatValue(value) }));
}

/*
 * The row's own one-line summary is NOT built here any more. The list no longer
 * carries the metadata blob — it is fetched per expanded row — so the preview
 * arrives as `metadataPreview`, computed by the backend from the same object.
 */

/*
 * What the entry happened to, as the row prints it: "Order · cms55ibmm0000".
 *
 * The id is shortened because a cuid is 25 characters of noise that would
 * dominate the column, and the leading segment is enough to match a row against
 * one an admin already has open. The full id is in the expanded panel, which is
 * where anyone actually copying it will be.
 */
const ID_PREVIEW_LENGTH = 14;

export function shortEntityId(entityId: string): string {
  return entityId.length > ID_PREVIEW_LENGTH
    ? `${entityId.slice(0, ID_PREVIEW_LENGTH)}…`
    : entityId;
}
