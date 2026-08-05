import {
  DetailField,
  DetailGrid,
  DetailPanel,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { AdminCarrier, AdminLocation } from '../../types/settings';

/*
 * The expanded panels under a location and a carrier row.
 *
 * Both rows print their usage as one compressed line ("3 services · 2 price
 * points · 41 orders"), which is what a scan needs. The panel breaks it apart,
 * because those numbers are the answer to the only hard question on this
 * screen: what happens if this row goes away. A location referenced by 41
 * orders is not a row anyone should be looking for a Delete button on — so the
 * panel says which references exist, and says in words why Delete is absent
 * rather than leaving its absence to be inferred.
 *
 * Neither panel fetches. These are a handful of configuration rows and the list
 * already carries every field; asking the server again for what the browser is
 * holding would be a round trip that buys nothing. The lazy part here is the
 * rendering.
 */

const DELETE_EXPLANATION =
  'Delete is unavailable because records already reference this. Switch it off instead — that closes it to new work while leaving it readable on everything that already points at it.';

const NEVER_USED = 'Nothing references this yet, so it can still be deleted outright.';

export function LocationDetails({ location }: { location: AdminLocation }) {
  return (
    <DetailPanel>
      <DetailGrid>
        <DetailField label="Services offered here">
          {location.usage.services}
        </DetailField>
        <DetailField label="Price points">
          {location.usage.pricingTiers}
        </DetailField>
        <DetailField label="Orders filed">{location.usage.orders}</DetailField>
        <DetailField label="Last updated">
          {formatOrderDate(location.updatedAt)}
        </DetailField>
      </DetailGrid>

      <p className="text-body text-text-secondary">
        {location.canDelete ? NEVER_USED : DELETE_EXPLANATION}
      </p>
    </DetailPanel>
  );
}

export function CarrierDetails({ carrier }: { carrier: AdminCarrier }) {
  return (
    <DetailPanel>
      <DetailGrid>
        <DetailField label="Code" mono>
          {carrier.code}
        </DetailField>
        <DetailField label="Shipments">{carrier.usage.shipments}</DetailField>
        <DetailField label="Offered">
          {carrier.active ? 'Yes' : 'No'}
        </DetailField>
        <DetailField label="Last updated">
          {formatOrderDate(carrier.updatedAt)}
        </DetailField>
      </DetailGrid>

      <p className="text-body text-text-secondary">
        {carrier.canDelete ? NEVER_USED : DELETE_EXPLANATION}
      </p>
    </DetailPanel>
  );
}
