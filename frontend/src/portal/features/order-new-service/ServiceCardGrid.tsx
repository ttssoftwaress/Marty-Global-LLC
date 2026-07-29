import type { OrderableService } from '../../types/order-new-service';
import { ServiceCard } from './ServiceCard';

/*
 * The service catalog as a responsive grid — one column stacked on mobile, two
 * columns from `md` (tablet and the desktop left column). Cards stretch to equal
 * height per row (`items-stretch` + the card's `h-full`) so a row reads as a
 * pair, matching all three links. The list length is whatever the catalog
 * returns, so a fifth/sixth service just flows onto the next row.
 */

type ServiceCardGridProps = {
  services: OrderableService[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
};

export function ServiceCardGrid({
  services,
  selectedIds,
  onToggle,
}: ServiceCardGridProps) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 md:gap-4 lg:gap-5">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          selected={selectedIds.has(service.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
