import type { OrderDetailField } from '../../types/orders';
import { DetailFieldList } from './DetailFieldList';
import { SectionCard } from './SectionCard';

// Order information — the order's metadata (id, service, country, dates,
// assigned agent) as a shared label/value list.
export function OrderInformationCard({ fields }: { fields: OrderDetailField[] }) {
  return (
    <SectionCard title="Order information" className="gap-4">
      <div className="mt-1">
        <DetailFieldList fields={fields} />
      </div>
    </SectionCard>
  );
}
