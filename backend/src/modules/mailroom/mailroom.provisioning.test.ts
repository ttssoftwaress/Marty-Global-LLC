import { describe, expect, it } from 'vitest';

import { composeAddress, isMailRoomService } from './mailroom.provisioning.js';

/*
 * Provisioning's decision layer is pure — no DB, no auth context — so these run
 * as plain unit tests.
 *
 * What they protect is the join between two things that can drift apart without
 * anything failing loudly: the result-field KEYS an admin configures on the
 * virtual-mail service, and the address this reads back out of them. If that
 * match breaks, a delivery still succeeds and the customer simply never gets a
 * mail room — the exact failure a type checker cannot catch.
 */

// The keys seed.ts actually registers for the virtual-mail service. If these are
// renamed there, this fixture must change with them — which is the point.
const seededAnswers = () =>
  new Map([
    ['mail_room_name', 'Delaware HQ'],
    ['mail_room_address_line1', '1209 Orange Street'],
    ['mail_room_address_line2', 'Suite 210'],
    ['mail_room_city', 'Wilmington'],
    ['mail_room_address_region', 'DE'],
    ['mail_room_postal_code', '19801'],
    ['mail_room_address_country', 'US'],
  ]);

describe('isMailRoomService', () => {
  it('matches the seeded service name', () => {
    expect(isMailRoomService('Virtual Mail Room')).toBe(true);
  });

  it('matches a renamed or region-scoped variant', () => {
    expect(isMailRoomService('Virtual Mail Room (UK)')).toBe(true);
    expect(isMailRoomService('virtualmail')).toBe(true);
  });

  it('does not match the other catalog services', () => {
    expect(isMailRoomService('Company Formation')).toBe(false);
    expect(isMailRoomService('Bank Account Opening Assistance')).toBe(false);
    expect(isMailRoomService('E-Commerce Account Setup')).toBe(false);
  });
});

describe('composeAddress', () => {
  it('resolves every part from the seeded field keys', () => {
    const address = composeAddress(seededAnswers());

    expect(address).toEqual({
      name: 'Delaware HQ',
      address: '1209 Orange Street, Suite 210, Wilmington, DE, 19801, US',
      line1: '1209 Orange Street',
      line2: 'Suite 210',
      city: 'Wilmington',
      region: 'DE',
      postalCode: '19801',
      country: 'US',
    });
  });

  /*
   * The suffix match must not let one field answer another's question. `region`
   * and `country` both end in keys the other could plausibly match, and a
   * mis-pick would put the country where the state belongs on a shipping label.
   */
  it('keeps region and country distinct', () => {
    const address = composeAddress(seededAnswers());

    expect(address?.region).toBe('DE');
    expect(address?.country).toBe('US');
  });

  it('accepts generic keys as well as namespaced ones', () => {
    const address = composeAddress(
      new Map([
        ['address_line1', '55 Baker Street'],
        ['city', 'London'],
        ['postal_code', 'W1U 7EW'],
        ['address_country', 'GB'],
      ]),
    );

    expect(address?.line1).toBe('55 Baker Street');
    expect(address?.city).toBe('London');
    expect(address?.postalCode).toBe('W1U 7EW');
    expect(address?.country).toBe('GB');
  });

  // Without a street line there is no address, and a room card reading "Unknown"
  // is worse than one an operator is told to finish by hand.
  it('refuses to build a room with no street line', () => {
    expect(
      composeAddress(new Map([['mail_room_city', 'Wilmington']])),
    ).toBeNull();
  });

  it('treats a blank answer as absent', () => {
    expect(
      composeAddress(
        new Map([
          ['mail_room_address_line1', '   '],
          ['mail_room_city', 'Wilmington'],
        ]),
      ),
    ).toBeNull();
  });

  // A room without a second line must not render "12 High St, , London".
  it('drops empty parts from the one-line address', () => {
    const address = composeAddress(
      new Map([
        ['mail_room_address_line1', '12 High Street'],
        ['mail_room_city', 'London'],
      ]),
    );

    expect(address?.address).toBe('12 High Street, London');
    expect(address?.line2).toBeNull();
  });

  // The card always prints a name, so an unnamed room gets the same default the
  // seeds use for a customer's first one.
  it('falls back to a default room name', () => {
    const address = composeAddress(
      new Map([['mail_room_address_line1', '12 High Street']]),
    );

    expect(address?.name).toBe('Main Office');
  });
});
