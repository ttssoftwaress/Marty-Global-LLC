import type { OrderDetailField } from '../../types/orders';
import { DetailFieldList } from './DetailFieldList';
import { SectionCard } from './SectionCard';

// Application details — the filing's captured fields (company name, entity type,
// state, agent, etc.) as a shared label/value list.
export function ApplicationDetailsCard({ fields }: { fields: OrderDetailField[] }) {
  return (
    <SectionCard title="Application details" className="gap-2 md:gap-0">
      <div className="mt-2 md:mt-0">
        <DetailFieldList fields={fields} />
      </div>
    </SectionCard>
  );
}
