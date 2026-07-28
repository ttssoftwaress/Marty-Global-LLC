import { DetailCard } from './DetailCard';
import { ToggleSwitch } from './ToggleSwitch';

/*
 * Whether customers can order this service.
 *
 * Not in the Figma links — the create modal sets `active` once and nothing could
 * change it afterwards, which left the catalog list printing an "Inactive" chip
 * no screen could produce or clear. It matters more now: a service a customer
 * has already ordered cannot be deleted (its orders point at it), and turning it
 * off is the alternative the list's refusal names, so the alternative has to
 * exist. Logged as a deviation.
 *
 * Saved through the page's shared draft like the cards above it, rather than a
 * toggle that writes on flip: an admin reworking a service's pricing and taking
 * it off sale is one decision, and Save is where this screen commits.
 */

type ServiceAvailabilityCardProps = {
  active: boolean;
  serviceName: string;
  onChange: (next: boolean) => void;
};

export function ServiceAvailabilityCard({
  active,
  serviceName,
  onChange,
}: ServiceAvailabilityCardProps) {
  return (
    <DetailCard title="Availability">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body font-medium text-text">
            {active ? 'Available to order' : 'Not available to order'}
          </p>
          <p className="text-body leading-[1.5] text-gray-500">
            {active
              ? 'Customers can order this service from the catalog.'
              : 'This service is hidden from the customer catalog. Orders already placed for it are unaffected and stay readable.'}
          </p>
        </div>

        <ToggleSwitch
          checked={active}
          onChange={onChange}
          label={`${serviceName} available to order`}
        />
      </div>
    </DetailCard>
  );
}
