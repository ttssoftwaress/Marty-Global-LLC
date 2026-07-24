import type { OrderDetailField } from '../../types/orders';

/*
 * A labelled label/value list, shared by Application details, Payment status,
 * and Order information so the three read identically. Two presentations,
 * swapped by breakpoint to match the Figma links:
 *   - mobile:       label above value, stacked pairs, no dividers
 *   - tablet/desktop: label left · value right on one row, bottom-divided
 *
 * The value column is emphasised (medium, primary text); the label is muted.
 * The last row drops its divider so the card doesn't end on a line.
 */

export function DetailFieldList({ fields }: { fields: OrderDetailField[] }) {
  return (
    <>
      {/* Mobile — stacked label/value pairs */}
      <dl className="flex flex-col gap-3 md:hidden">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-1">
            <dt className="text-small text-text-secondary">{field.label}</dt>
            <dd className="text-body font-medium text-text">{field.value}</dd>
          </div>
        ))}
      </dl>

      {/* Tablet & desktop — divided rows */}
      <dl className="hidden flex-col md:flex">
        {fields.map((field) => (
          <div
            key={field.label}
            className="flex items-center justify-between gap-4 border-b border-gray-200 py-3.5 last:border-b-0"
          >
            <dt className="shrink-0 text-body text-text-secondary">{field.label}</dt>
            <dd className="min-w-0 text-right text-body font-medium text-text">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
