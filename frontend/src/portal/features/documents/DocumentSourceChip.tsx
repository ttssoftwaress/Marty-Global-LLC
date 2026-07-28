import type { DocumentSource } from '../../types/documents';

/*
 * Which of the three sources a document came from. Uses the shared status-token
 * pairs rather than new colors, so the chip sits in the same palette as every
 * other pill in the portal.
 */

const SOURCE_STYLE: Record<DocumentSource, { label: string; className: string }> = {
  order: {
    label: 'Order',
    className:
      'bg-[var(--color-status-submitted-bg)] text-[color:var(--color-status-submitted-text)]',
  },
  record: {
    label: 'Record',
    className:
      'bg-[var(--color-status-completed-bg)] text-[color:var(--color-status-completed-text)]',
  },
  mail: {
    label: 'Mail',
    className:
      'bg-[var(--color-status-processing-bg)] text-[color:var(--color-status-processing-text)]',
  },
};

export function DocumentSourceChip({ source }: { source: DocumentSource }) {
  const { label, className } = SOURCE_STYLE[source];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill px-2.5 py-1 text-caption font-medium ${className}`}
    >
      {label}
    </span>
  );
}
