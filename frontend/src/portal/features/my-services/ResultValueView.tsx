import { format, parseISO } from 'date-fns';
import { Download, ExternalLink, FileText } from 'lucide-react';

import { formatFileSize } from '../../lib/format';
import type { ResultField, ResultValue, StatusTone } from '../../types/my-services';

/*
 * How one delivered fact renders — the single place this app turns a stored
 * value into something a customer reads.
 *
 * Everything on both the table and the detail page goes through here, which is
 * what makes the whole surface data-driven: a service that starts returning a
 * new fact renders correctly with no change in this app, because the field's
 * `type` already has a case.
 *
 * The backend sends the scalar untouched and this formats it, so a date lands in
 * the viewer's own zone and a number in their own locale (AGENTS.md, Dates).
 * Money is deliberately not a case: an amount owed belongs to billing, and a
 * result field never carries one.
 */

/*
 * A status chip's tone → design tokens. The admin picks a MEANING and this picks
 * the hue, so no hex ever reaches the catalog (Design.md).
 *
 * These reuse the order-status chip tokens already in the sheet rather than
 * introducing a parallel palette — a "completed" filing and an "active" company
 * should read the same green.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  success:
    'bg-[var(--color-status-completed-bg)] text-[color:var(--color-status-completed-text)]',
  warning:
    'bg-[var(--color-status-review-bg)] text-[color:var(--color-status-review-text)]',
  error:
    'bg-[var(--color-status-missing-bg)] text-[color:var(--color-status-missing-text)]',
  info: 'bg-primary-light text-primary',
};

export function StatusChip({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-caption font-semibold ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}

/*
 * A number, grouped for the viewer's locale.
 *
 * `decimals` is a render setting the registry carries, so a value stored with
 * more precision than it displays keeps that precision in the database and only
 * rounds here. A value that isn't a number falls through as text rather than
 * printing NaN — the backend validates on write, but a row stored before a field
 * was reshaped must still render.
 */
function formatNumber(value: string, field: Extract<ResultField, { type: 'number' }>) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;

  const body = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: field.decimals ?? 0,
    maximumFractionDigits: field.decimals ?? 3,
  }).format(parsed);

  return `${field.prefix ?? ''}${body}${field.suffix ?? ''}`;
}

// An em dash rather than an empty cell, so a blank optional field reads as
// "nothing here" instead of a rendering failure.
export function EmptyValue() {
  return <span className="text-body text-gray-400">—</span>;
}

type ResultValueViewProps = {
  field: ResultField;
  value: ResultValue | undefined;
  // A presigned download link for a `file` field, minted per request. Absent
  // means the object is not available yet.
  downloadUrl?: string;
  // The table needs one line; the detail page can breathe. Only `textarea` and
  // `file` actually differ.
  compact?: boolean;
};

export function ResultValueView({
  field,
  value,
  downloadUrl,
  compact,
}: ResultValueViewProps) {
  if (field.type === 'file') {
    if (!value?.file) return <EmptyValue />;

    const { name, sizeBytes } = value.file;

    // No link yet means the team owes us the document — the same "pending"
    // reading the order screen's document rows use.
    if (!downloadUrl) {
      return (
        <span className="inline-flex items-center gap-2 text-body text-gray-500">
          <FileText className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">{name}</span>
          <span className="text-caption text-gray-400">Preparing</span>
        </span>
      );
    }

    return (
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-2 text-body font-medium text-primary hover:underline ${
          compact ? '' : 'rounded-input border border-gray-200 bg-white px-3 py-2'
        }`}
      >
        <FileText className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="truncate">{name}</span>
        {sizeBytes !== null && !compact ? (
          <span className="text-caption text-gray-500">{formatFileSize(sizeBytes)}</span>
        ) : null}
        <Download className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </a>
    );
  }

  const raw = value?.value;
  if (raw === null || raw === undefined || raw.trim().length === 0) {
    return <EmptyValue />;
  }

  switch (field.type) {
    case 'status':
      return <StatusChip label={value?.displayValue ?? raw} tone={value?.tone ?? 'neutral'} />;

    case 'select':
      // The label is resolved server-side from the definition, so a re-worded
      // option updates every record that holds it.
      return <span className="text-body text-text">{value?.displayValue ?? raw}</span>;

    case 'date': {
      const parsed = parseISO(raw);
      if (Number.isNaN(parsed.getTime())) {
        return <span className="text-body text-text">{raw}</span>;
      }
      return (
        <time dateTime={raw} className="text-body text-text">
          {format(parsed, field.withTime ? 'MMM d, yyyy · h:mm a' : 'MMM d, yyyy')}
        </time>
      );
    }

    case 'number':
      // Tabular figures so a column of numbers aligns on its digits.
      return (
        <span className="text-body tabular-nums text-text">{formatNumber(raw, field)}</span>
      );

    case 'url':
      return (
        <a
          href={raw}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-body font-medium text-primary hover:underline"
        >
          <span className="truncate">{raw.replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        </a>
      );

    case 'textarea':
      return (
        <span
          className={`text-body text-text ${
            compact ? 'block truncate' : 'block whitespace-pre-wrap'
          }`}
        >
          {raw}
        </span>
      );

    case 'text':
    default:
      return <span className="text-body text-text">{raw}</span>;
  }
}

// The plain-text form of a value, for a table cell's `title` and for search.
// Mirrors the cases above without the markup.
export function resultValueText(
  field: ResultField,
  value: ResultValue | undefined,
): string {
  if (field.type === 'file') return value?.file?.name ?? '';

  const raw = value?.value;
  if (!raw) return '';

  if (field.type === 'select' || field.type === 'status') {
    return value?.displayValue ?? raw;
  }

  if (field.type === 'date') {
    const parsed = parseISO(raw);
    return Number.isNaN(parsed.getTime())
      ? raw
      : format(parsed, field.withTime ? 'MMM d, yyyy · h:mm a' : 'MMM d, yyyy');
  }

  if (field.type === 'number') return formatNumber(raw, field);

  return raw;
}
