import type { AdminOrderItem } from '../../types/order-detail';
import { SectionCard } from './SectionCard';

/*
 * The application itself — what the customer answered, grouped by the service
 * they answered it for.
 *
 * The grouping is not cosmetic: an order can hold several services, two of them
 * can ask the same question, and a reviewer checking a company name against a
 * jurisdiction has to know which application each answer belongs to. A single
 * flat list would read as one form that it never was.
 *
 * Each group is a definition list — label above value on mobile, two columns
 * from `md` up where the row has the width for it. Values wrap rather than
 * truncate; an answer the reviewer cannot read in full is the one case where
 * losing a character matters.
 */

type OrderApplicationCardProps = {
  items: AdminOrderItem[];
  notes: string | null;
};

function FieldList({ fields }: { fields: AdminOrderItem['fields'] }) {
  if (fields.length === 0) {
    return (
      <p className="text-body text-gray-400">No details were captured for this service.</p>
    );
  }

  return (
    <dl className="flex flex-col gap-3">
      {fields.map((field) => (
        <div
          key={field.label}
          className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-4"
        >
          <dt className="text-small font-semibold uppercase tracking-[0.4px] text-gray-500 md:w-[200px] md:shrink-0 md:normal-case md:tracking-normal md:text-body md:font-medium">
            {field.label}
          </dt>
          <dd className="min-w-0 break-words text-body text-text">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OrderApplicationCard({ items, notes }: OrderApplicationCardProps) {
  return (
    <SectionCard title="Application details" className="gap-5">
      <div className="flex flex-col gap-5">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={
              index > 0 ? 'flex flex-col gap-3 border-t border-gray-100 pt-5' : 'flex flex-col gap-3'
            }
          >
            <h3 className="text-body font-semibold text-primary">{item.serviceName}</h3>
            <FieldList fields={item.fields} />
          </div>
        ))}
      </div>

      {notes ? (
        <div className="flex flex-col gap-1.5 rounded-input bg-gray-50 p-3.5">
          <p className="text-small font-semibold uppercase tracking-[0.4px] text-gray-500">
            Customer note
          </p>
          <p className="whitespace-pre-line break-words text-body text-text-secondary">
            {notes}
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
