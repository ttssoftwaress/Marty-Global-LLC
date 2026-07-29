import { MailRoomStatus, type Prisma } from '@prisma/client';

import { logger } from '../../lib/logger.js';

/*
 * Opening a customer's mail room when the team delivers the service.
 *
 * This is the join between the order pipeline and the mail room: until an item
 * for the virtual-mail service is delivered, the customer has no room, the
 * `/app/mailroom` screen is empty, and an operator filing a scan is told the
 * customer "has no active mail room to file into". Delivering the item is what
 * opens it.
 *
 * The address is NOT invented here. Staff enter it on the service's result form
 * — an admin-configured form, so which questions it asks is a catalog change
 * rather than a deploy — and this reads the answers back out by their registry
 * keys. That is why the field keys below are the contract: renaming one in the
 * registry detaches it from provisioning, so they are matched leniently (any
 * key ending in the expected suffix) and the room still opens if the operator
 * filled in at least a first line.
 */

// Which service provisions a room, matched on the service NAME rather than an id
// so a renamed or re-seeded catalog row keeps working. Deliberately loose: a
// "Virtual Mail Room (UK)" is still a virtual mail room.
const MAIL_SERVICE_PATTERN = /virtual\s*mail/i;

export function isMailRoomService(serviceName: string): boolean {
  return MAIL_SERVICE_PATTERN.test(serviceName);
}

/*
 * The result-form answers a room is built from, keyed by registry field key.
 *
 * Matched by suffix so both a generic key (`address_line1`) and a namespaced one
 * (`mail_room_address_line1`) resolve — the admin owns the registry and may key
 * these however the rest of their catalog reads.
 */
const FIELD_SUFFIXES = {
  name: ['room_name', 'mailroom_name', 'location_name'],
  line1: ['address_line1', 'line1', 'street_address'],
  line2: ['address_line2', 'line2'],
  city: ['city', 'town'],
  region: ['address_region', 'state', 'province', 'region'],
  postalCode: ['postal_code', 'postcode', 'zip', 'zip_code'],
  country: ['address_country', 'country'],
} as const;

type AddressPart = keyof typeof FIELD_SUFFIXES;

function pick(values: Map<string, string>, part: AddressPart): string | null {
  for (const suffix of FIELD_SUFFIXES[part]) {
    for (const [key, value] of values) {
      const normalised = key.toLowerCase();
      if (
        (normalised === suffix || normalised.endsWith(`_${suffix}`)) &&
        value.trim()
      ) {
        return value.trim();
      }
    }
  }
  return null;
}

export type MailRoomAddress = {
  name: string;
  address: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
};

/*
 * Compose the one-line address the room cards render, from the parts staff
 * filled in. Blank parts are dropped rather than printed as empty segments, so a
 * room without a second line does not read "12 High St, , London".
 */
export function composeAddress(
  values: Map<string, string>,
): MailRoomAddress | null {
  const line1 = pick(values, 'line1');

  // Without a street line there is no address, and a room whose card reads
  // "Unknown" is worse than one the operator is told to finish by hand.
  if (!line1) return null;

  const line2 = pick(values, 'line2');
  const city = pick(values, 'city');
  const region = pick(values, 'region');
  const postalCode = pick(values, 'postalCode');
  const country = pick(values, 'country');

  const address = [line1, line2, city, region, postalCode, country]
    .filter((part): part is string => Boolean(part))
    .join(', ');

  return {
    // The card always shows a name; "Main Office" is what the seeds use for a
    // customer's first room.
    name: pick(values, 'name') ?? 'Main Office',
    address,
    line1,
    line2,
    city,
    region,
    postalCode,
    country,
  };
}

/*
 * Open the room, inside the caller's transaction.
 *
 * Runs in the same transaction as the delivery it belongs to: an item marked
 * complete without its room would tell the customer their mail room is live
 * while `/app/mailroom` shows nothing, and there would be no second event to
 * repair it from.
 *
 * Idempotent on `orderItemId` (unique): re-delivering an item — staff editing a
 * result and saving again — never opens a second room.
 */
export async function provisionMailRoom(
  tx: Prisma.TransactionClient,
  input: {
    orderItemId: string;
    customerId: string;
    values: Map<string, string>;
  },
): Promise<{ provisioned: boolean; roomId?: string; reason?: string }> {
  const existing = await tx.mailRoom.findFirst({
    where: { orderItemId: input.orderItemId },
    select: { id: true },
  });

  if (existing) return { provisioned: false, roomId: existing.id, reason: 'exists' };

  const address = composeAddress(input.values);

  /*
   * No usable address on the form. The delivery still stands — refusing it would
   * block the team over a field the catalog may not even ask for — but nothing
   * is opened, and the log says why so an operator can add the room by hand.
   */
  if (!address) {
    logger.warn(
      { orderItemId: input.orderItemId },
      'Virtual mail item delivered without an address on its result form; no room opened',
    );
    return { provisioned: false, reason: 'no-address' };
  }

  const room = await tx.mailRoom.create({
    data: {
      customerId: input.customerId,
      orderItemId: input.orderItemId,
      name: address.name,
      address: address.address,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
      // Live immediately: the team delivering the service IS the moment the
      // address starts receiving post. PENDING is for a room recorded before it
      // is usable, which is not this path.
      status: MailRoomStatus.ACTIVE,
    },
    select: { id: true },
  });

  return { provisioned: true, roomId: room.id };
}
