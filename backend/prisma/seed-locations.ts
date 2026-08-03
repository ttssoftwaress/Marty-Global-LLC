import type { PrismaClient } from '@prisma/client';

/*
 * WHERE WE OPERATE — the one list the rest of the seed derives from.
 *
 * Three things are built out of it, and they must agree or the order form
 * breaks in ways nobody sees until a customer meets it:
 *
 *   1. `Region` rows — the jurisdictions the admin queue filters on and a
 *      service's coverage is toggled against (`/admin/settings` → Locations).
 *   2. The `country → state → address` dropdown cascade in the field registry.
 *      Every choice is generated from `ADDRESSES` below, so an address we do not
 *      actually hold can never be offered, and a state with no address in it
 *      never appears.
 *   3. Company formation coverage — we can only form (and act as registered
 *      agent) where we hold a street address, so the formation chain reads off
 *      the same table rather than a second list that would drift from it.
 *
 * Adding a location afterwards is an ADMIN action, not a re-seed: locations are
 * managed at `/admin/settings` and a service's coverage at
 * `/admin/catalog/:serviceId`. This file is the starting set, not the authority.
 *
 * Idempotent: every row upserts on its stable code.
 */

// --- Countries -------------------------------------------------------------
// `code` is ISO 3166-1 alpha-2. `flag` is an emoji — text, never an exported
// asset (Design.md). The order is the one every dropdown prints.

export type SeedLocation = {
  code: string;
  label: string;
  flag: string;
  sortOrder: number;
};

export const LOCATIONS: SeedLocation[] = [
  { code: 'US', label: 'United States', flag: '🇺🇸', sortOrder: 1 },
  { code: 'CA', label: 'Canada', flag: '🇨🇦', sortOrder: 2 },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧', sortOrder: 3 },
  { code: 'IE', label: 'Ireland', flag: '🇮🇪', sortOrder: 4 },
  { code: 'NL', label: 'Netherlands', flag: '🇳🇱', sortOrder: 5 },
  { code: 'ES', label: 'Spain', flag: '🇪🇸', sortOrder: 6 },
  { code: 'IT', label: 'Italy', flag: '🇮🇹', sortOrder: 7 },
  { code: 'AT', label: 'Austria', flag: '🇦🇹', sortOrder: 8 },
  { code: 'CH', label: 'Switzerland', flag: '🇨🇭', sortOrder: 9 },
  { code: 'SG', label: 'Singapore', flag: '🇸🇬', sortOrder: 10 },
  { code: 'TW', label: 'Taiwan', flag: '🇹🇼', sortOrder: 11 },
  { code: 'BR', label: 'Brazil', flag: '🇧🇷', sortOrder: 12 },
];

/*
 * The addresses we hold, in full.
 *
 * `value` is what an answer records, and it is immutable in the same way a field
 * key is — an order placed against `us-de-dover` must still resolve to this row
 * years later, so a retired address is removed from the option list by an admin
 * rather than renamed here.
 *
 * `state` is the middle rung of the cascade. Outside the US it is the province,
 * canton, or city-region the address sits in, so every country reads through the
 * same three levels instead of the form branching on whether a country has
 * states.
 */
export type SeedAddress = {
  value: string;
  country: string;
  state: string;
  stateLabel: string;
  line1: string;
  line2?: string;
  city: string;
  // What the address prints between city and postal code — the USPS state
  // abbreviation, or the local equivalent ("Noord Holland", "ON").
  region: string;
  postalCode: string;
};

export const ADDRESSES: SeedAddress[] = [
  // --- United States ------------------------------------------------------
  {
    value: 'us-al-huntsville',
    country: 'us',
    state: 'us-al',
    stateLabel: 'Alabama',
    line1: '600 Boulevard South SW',
    line2: 'Suite 104',
    city: 'Huntsville',
    region: 'AL',
    postalCode: '35802',
  },
  {
    value: 'us-ak-anchorage',
    country: 'us',
    state: 'us-ak',
    stateLabel: 'Alaska',
    line1: '750 W Dimond Blvd',
    line2: 'Ste 103',
    city: 'Anchorage',
    region: 'AK',
    postalCode: '99515',
  },
  {
    value: 'us-az-bullhead-city',
    country: 'us',
    state: 'us-az',
    stateLabel: 'Arizona',
    line1: '1812 Hwy 95',
    line2: 'Ste 14',
    city: 'Bullhead City',
    region: 'AZ',
    postalCode: '86442',
  },
  {
    value: 'us-ca-alameda',
    country: 'us',
    state: 'us-ca',
    stateLabel: 'California',
    line1: '1311 Park St',
    city: 'Alameda',
    region: 'CA',
    postalCode: '94501',
  },
  {
    value: 'us-co-denver',
    country: 'us',
    state: 'us-co',
    stateLabel: 'Colorado',
    line1: '1905 Sherman Street',
    line2: 'Ste 200',
    city: 'Denver',
    region: 'CO',
    postalCode: '80203',
  },
  {
    value: 'us-dc-washington',
    country: 'us',
    state: 'us-dc',
    stateLabel: 'District of Columbia',
    line1: '712 H Street NE',
    city: 'Washington',
    region: 'DC',
    postalCode: '20002',
  },
  {
    value: 'us-de-dover',
    country: 'us',
    state: 'us-de',
    stateLabel: 'Delaware',
    line1: '1041 N Dupont Hwy',
    city: 'Dover',
    region: 'DE',
    postalCode: '19901',
  },
  {
    value: 'us-fl-brandon',
    country: 'us',
    state: 'us-fl',
    stateLabel: 'Florida',
    line1: '504 S Kings Ave',
    city: 'Brandon',
    region: 'FL',
    postalCode: '33511',
  },
  {
    value: 'us-ga-albany',
    country: 'us',
    state: 'us-ga',
    stateLabel: 'Georgia',
    line1: '501 N. Slappey Blvd.',
    city: 'Albany',
    region: 'GA',
    postalCode: '31701',
  },
  {
    value: 'us-gu-dededo',
    country: 'us',
    state: 'us-gu',
    stateLabel: 'Guam',
    line1: '753 Route 3',
    line2: 'Suite 106',
    city: 'Dededo',
    region: 'GU',
    postalCode: '96929',
  },
  {
    value: 'us-hi-honolulu',
    country: 'us',
    state: 'us-hi',
    stateLabel: 'Hawaii',
    line1: '1003 Bishop Street',
    line2: 'Suite 2700',
    city: 'Honolulu',
    region: 'HI',
    postalCode: '96813',
  },
  {
    value: 'us-il-chicago',
    country: 'us',
    state: 'us-il',
    stateLabel: 'Illinois',
    line1: '3561 S Archer Ave',
    city: 'Chicago',
    region: 'IL',
    postalCode: '60609',
  },
  {
    value: 'us-il-carbondale',
    country: 'us',
    state: 'us-il',
    stateLabel: 'Illinois',
    line1: '1325 East Main St.',
    city: 'Carbondale',
    region: 'IL',
    postalCode: '62901',
  },
  {
    value: 'us-in-carmel',
    country: 'us',
    state: 'us-in',
    stateLabel: 'Indiana',
    line1: '550 Congressional Blvd',
    line2: 'Suite 390',
    city: 'Carmel',
    region: 'IN',
    postalCode: '46032',
  },
  {
    value: 'us-ia-ankeny',
    country: 'us',
    state: 'us-ia',
    stateLabel: 'Iowa',
    line1: '2407 SE Delaware Avenue',
    city: 'Ankeny',
    region: 'IA',
    postalCode: '50021',
  },
  {
    value: 'us-ks-junction-city',
    country: 'us',
    state: 'us-ks',
    stateLabel: 'Kansas',
    line1: '1106 West Ash Street',
    city: 'Junction City',
    region: 'KS',
    postalCode: '66441',
  },
  {
    value: 'us-ky-bowling-green',
    country: 'us',
    state: 'us-ky',
    stateLabel: 'Kentucky',
    line1: '1680 Campbell Ln',
    line2: 'STE 109',
    city: 'Bowling Green',
    region: 'KY',
    postalCode: '42104',
  },
  {
    value: 'us-la-baton-rouge',
    country: 'us',
    state: 'us-la',
    stateLabel: 'Louisiana',
    line1: '6554 Florida Blvd',
    line2: 'Suite 110',
    city: 'Baton Rouge',
    region: 'LA',
    postalCode: '70806',
  },
  {
    value: 'us-me-augusta',
    country: 'us',
    state: 'us-me',
    stateLabel: 'Maine',
    line1: '126 Western Avenue',
    city: 'Augusta',
    region: 'ME',
    postalCode: '04330',
  },
  {
    value: 'us-md-clinton',
    country: 'us',
    state: 'us-md',
    stateLabel: 'Maryland',
    line1: '8861 Branch Ave',
    city: 'Clinton',
    region: 'MD',
    postalCode: '20735',
  },
  {
    value: 'us-ma-danvers',
    country: 'us',
    state: 'us-ma',
    stateLabel: 'Massachusetts',
    line1: '230 Independence Way',
    line2: 'STE 1',
    city: 'Danvers',
    region: 'MA',
    postalCode: '01923',
  },
  {
    value: 'us-mi-bloomfield-hills',
    country: 'us',
    state: 'us-mi',
    stateLabel: 'Michigan',
    line1: '43313 Woodward Ave',
    city: 'Bloomfield Hills',
    region: 'MI',
    postalCode: '48302',
  },
  {
    value: 'us-mn-bloomington',
    country: 'us',
    state: 'us-mn',
    stateLabel: 'Minnesota',
    line1: '3800 American Blvd. West',
    line2: 'Suite 1500',
    city: 'Bloomington',
    region: 'MN',
    postalCode: '55431',
  },
  {
    value: 'us-ms-biloxi',
    country: 'us',
    state: 'us-ms',
    stateLabel: 'Mississippi',
    line1: '296 Beauvoir Rd',
    line2: 'Suite 100',
    city: 'Biloxi',
    region: 'MS',
    postalCode: '39531',
  },
  {
    value: 'us-mo-cape-girardeau',
    country: 'us',
    state: 'us-mo',
    stateLabel: 'Missouri',
    line1: '294 Siemers Dr.',
    city: 'Cape Girardeau',
    region: 'MO',
    postalCode: '63701',
  },
  {
    value: 'us-ne-fremont',
    country: 'us',
    state: 'us-ne',
    stateLabel: 'Nebraska',
    line1: '1039 East 23rd',
    city: 'Fremont',
    region: 'NE',
    postalCode: '68025',
  },
  {
    value: 'us-nv-reno',
    country: 'us',
    state: 'us-nv',
    stateLabel: 'Nevada',
    line1: '355 E Plumb Lane',
    city: 'Reno',
    region: 'NV',
    postalCode: '89502',
  },
  {
    value: 'us-nh-bedford',
    country: 'us',
    state: 'us-nh',
    stateLabel: 'New Hampshire',
    line1: '1 Hardy Road',
    city: 'Bedford',
    region: 'NH',
    postalCode: '03110',
  },
  {
    value: 'us-nj-garfield',
    country: 'us',
    state: 'us-nj',
    stateLabel: 'New Jersey',
    line1: '69 Passaic St',
    city: 'Garfield',
    region: 'NJ',
    postalCode: '07026',
  },
  {
    value: 'us-nm-albuquerque',
    country: 'us',
    state: 'us-nm',
    stateLabel: 'New Mexico',
    line1: '8531 Indian School Rd NE',
    city: 'Albuquerque',
    region: 'NM',
    postalCode: '87112',
  },
  {
    value: 'us-ny-albany',
    country: 'us',
    state: 'us-ny',
    stateLabel: 'New York',
    line1: '350 Northern Blvd',
    line2: 'STE 324',
    city: 'Albany',
    region: 'NY',
    postalCode: '12204-1000',
  },
  {
    value: 'us-nc-thomasville',
    country: 'us',
    state: 'us-nc',
    stateLabel: 'North Carolina',
    line1: '50 E Main St',
    line2: 'Suite 100',
    city: 'Thomasville',
    region: 'NC',
    postalCode: '27360',
  },
  {
    value: 'us-nd-jamestown',
    country: 'us',
    state: 'us-nd',
    stateLabel: 'North Dakota',
    line1: '218 First Ave S',
    city: 'Jamestown',
    region: 'ND',
    postalCode: '58401',
  },
  {
    value: 'us-oh-cleveland',
    country: 'us',
    state: 'us-oh',
    stateLabel: 'Ohio',
    line1: '11811 Shaker Blvd',
    line2: 'Suite 204',
    city: 'Cleveland',
    region: 'OH',
    postalCode: '44120',
  },
  {
    value: 'us-ok-bartlesville',
    country: 'us',
    state: 'us-ok',
    stateLabel: 'Oklahoma',
    line1: '2400 SE Washington Blvd.',
    city: 'Bartlesville',
    region: 'OK',
    postalCode: '74006',
  },
  {
    value: 'us-or-corvallis',
    country: 'us',
    state: 'us-or',
    stateLabel: 'Oregon',
    line1: '2397 NW Kings Blvd',
    city: 'Corvallis',
    region: 'OR',
    postalCode: '97330-3985',
  },
  {
    value: 'us-pa-allentown',
    country: 'us',
    state: 'us-pa',
    stateLabel: 'Pennsylvania',
    line1: '3300 Lehigh Street',
    line2: 'SPC 224',
    city: 'Allentown',
    region: 'PA',
    postalCode: '18103',
  },
  {
    value: 'us-pr-caguas',
    country: 'us',
    state: 'us-pr',
    stateLabel: 'Puerto Rico',
    line1: 'Carr 1 km 40.8 Turabo',
    line2: 'HC4 Box 44374',
    city: 'Caguas',
    region: 'PR',
    postalCode: '00727',
  },
  {
    value: 'us-ri-cumberland',
    country: 'us',
    state: 'us-ri',
    stateLabel: 'Rhode Island',
    line1: '45 Industrial Road',
    line2: 'Suite 100',
    city: 'Cumberland',
    region: 'RI',
    postalCode: '02864',
  },
  {
    value: 'us-sc-bluffton',
    country: 'us',
    state: 'us-sc',
    stateLabel: 'South Carolina',
    line1: '1050 Fording Island Road',
    line2: 'STE C',
    city: 'Bluffton',
    region: 'SC',
    postalCode: '29910',
  },
  {
    value: 'us-sd-belle-fourche',
    country: 'us',
    state: 'us-sd',
    stateLabel: 'South Dakota',
    line1: '612 State St',
    city: 'Belle Fourche',
    region: 'SD',
    postalCode: '57717',
  },
  {
    value: 'us-tn-atoka',
    country: 'us',
    state: 'us-tn',
    stateLabel: 'Tennessee',
    line1: '11180 Hwy 51 S',
    line2: 'Ste 7',
    city: 'Atoka',
    region: 'TN',
    postalCode: '38004',
  },
  {
    value: 'us-tx-amarillo',
    country: 'us',
    state: 'us-tx',
    stateLabel: 'Texas',
    line1: '2766 Duniven Cir',
    city: 'Amarillo',
    region: 'TX',
    postalCode: '79109-1621',
  },
  {
    value: 'us-ut-logan',
    country: 'us',
    state: 'us-ut',
    stateLabel: 'Utah',
    line1: '1427 North Main St',
    line2: 'Suite A',
    city: 'Logan',
    region: 'UT',
    postalCode: '84341',
  },
  {
    value: 'us-vt-barre',
    country: 'us',
    state: 'us-vt',
    stateLabel: 'Vermont',
    line1: '168 Ames Drive',
    line2: 'STE 5',
    city: 'Barre',
    region: 'VT',
    postalCode: '05641',
  },
  {
    value: 'us-va-alexandria',
    country: 'us',
    state: 'us-va',
    stateLabel: 'Virginia',
    line1: '2800 Eisenhower Ave',
    line2: 'Suite 220',
    city: 'Alexandria',
    region: 'VA',
    postalCode: '22314',
  },
  {
    value: 'us-va-arlington',
    country: 'us',
    state: 'us-va',
    stateLabel: 'Virginia',
    line1: '2300 Wilson Blvd.',
    line2: 'Ste 700',
    city: 'Arlington',
    region: 'VA',
    postalCode: '22201',
  },
  {
    value: 'us-wa-quincy',
    country: 'us',
    state: 'us-wa',
    stateLabel: 'Washington',
    line1: '501 Central Ave S',
    city: 'Quincy',
    region: 'WA',
    postalCode: '98848',
  },
  {
    value: 'us-wv-beckley',
    country: 'us',
    state: 'us-wv',
    stateLabel: 'West Virginia',
    line1: '18 By Pass Plaza',
    city: 'Beckley',
    region: 'WV',
    postalCode: '25801',
  },
  {
    value: 'us-wi-appleton',
    country: 'us',
    state: 'us-wi',
    stateLabel: 'Wisconsin',
    line1: '1835 E. Edgewood Dr.',
    line2: 'Suite 105',
    city: 'Appleton',
    region: 'WI',
    postalCode: '54913',
  },
  {
    value: 'us-wy-buffalo',
    country: 'us',
    state: 'us-wy',
    stateLabel: 'Wyoming',
    line1: '63 N. Burritt Ave',
    line2: 'Room 100 East',
    city: 'Buffalo',
    region: 'WY',
    postalCode: '82834',
  },
  {
    value: 'us-wy-casper',
    country: 'us',
    state: 'us-wy',
    stateLabel: 'Wyoming',
    line1: '312 W. 2nd St',
    city: 'Casper',
    region: 'WY',
    postalCode: '82601',
  },
  {
    value: 'us-wy-cheyenne',
    country: 'us',
    state: 'us-wy',
    stateLabel: 'Wyoming',
    line1: '2232 Dell Range Blvd',
    line2: 'Suite 303',
    city: 'Cheyenne',
    region: 'WY',
    postalCode: '82009',
  },

  // --- Rest of the world --------------------------------------------------
  {
    value: 'ca-on-cambridge',
    country: 'ca',
    state: 'ca-on',
    stateLabel: 'Ontario',
    line1: '1025 King Street East',
    line2: 'Unit 107',
    city: 'Cambridge',
    region: 'ON',
    postalCode: 'N3H 3P5',
  },
  {
    value: 'gb-lnd-london',
    country: 'gb',
    state: 'gb-lnd',
    stateLabel: 'Greater London',
    line1: '275 New North Road',
    line2: 'Islington',
    city: 'London',
    region: 'England',
    postalCode: 'N1 7AA',
  },
  {
    value: 'ie-ld-longford',
    country: 'ie',
    state: 'ie-ld',
    stateLabel: 'County Longford',
    line1: 'Unit 1A Heatherview Business Park',
    line2: 'Athlone Road',
    city: 'Longford',
    region: 'Co Longford',
    postalCode: 'N39 KD82',
  },
  {
    value: 'nl-nh-hoofddorp',
    country: 'nl',
    state: 'nl-nh',
    stateLabel: 'Noord-Holland',
    line1: 'Paxlaan 10',
    city: 'Hoofddorp',
    region: 'Noord Holland',
    postalCode: '2131 PZ',
  },
  {
    value: 'es-md-madrid',
    country: 'es',
    state: 'es-md',
    stateLabel: 'Madrid',
    line1: 'Calle de Velázquez 50',
    line2: 'Planta 5',
    city: 'Madrid',
    region: 'Madrid',
    postalCode: '28001',
  },
  {
    value: 'it-ve-marghera',
    country: 'it',
    state: 'it-ve',
    stateLabel: 'Venice (Veneto)',
    line1: 'Via Longhena 1',
    city: 'Marghera (VE)',
    region: 'Veneto',
    postalCode: '30175',
  },
  {
    value: 'at-w-vienna',
    country: 'at',
    state: 'at-w',
    stateLabel: 'Vienna',
    line1: 'Nauschgasse 4/3/2',
    city: 'Vienna',
    region: 'Wien',
    postalCode: '1220',
  },
  {
    value: 'ch-vd-nyon',
    country: 'ch',
    state: 'ch-vd',
    stateLabel: 'Vaud',
    line1: 'Route de Saint-Cergue 24bis',
    city: 'Nyon',
    region: 'VD',
    postalCode: '1260',
  },
  {
    value: 'sg-central-singapore',
    country: 'sg',
    state: 'sg-central',
    stateLabel: 'Central Singapore',
    line1: '200 Jalan Sultan',
    line2: '#08-02 Textile Centre',
    city: 'Singapore',
    region: 'Singapore',
    postalCode: '199018',
  },
  {
    value: 'tw-tao-taoyuan',
    country: 'tw',
    state: 'tw-tao',
    stateLabel: 'Taoyuan City',
    line1: '18F., No.172, Sec. 2, Linghang N. Rd.',
    line2: 'Zhongli Dist.',
    city: 'Taoyuan City',
    region: 'Taoyuan',
    postalCode: '320014',
  },
  {
    value: 'br-pr-curitiba',
    country: 'br',
    state: 'br-pr',
    stateLabel: 'Paraná',
    line1: 'Avenida Republica Argentina 900',
    line2: 'Loja 28',
    city: 'Curitiba',
    region: 'PR',
    postalCode: '80620-010',
  },
];

// --- Dropdown option builders ---------------------------------------------
/*
 * The cascade, generated rather than hand-written.
 *
 * A dependent dropdown's choice carries `when`, the parent answers it belongs
 * to, and a dropdown with a parent offers NOTHING until that parent is answered
 * (services.validation.ts). Generating all three levels from `ADDRESSES` is what
 * guarantees the three lists agree: a state exists only because an address in it
 * does, and a country only because a state does.
 */

export type SeedFieldOption = {
  value: string;
  label: string;
  when?: string[];
};

// The lower-case country slug an answer records, from the upper-case `Region`
// code. `Order.regionCode` is derived by upper-casing it again
// (orders.service.ts), so the two vocabularies stay one substitution apart.
const slugOf = (code: string) => code.toLowerCase();

// Countries we hold at least one address in, in `LOCATIONS` order.
export function countryOptions(): SeedFieldOption[] {
  const held = new Set(ADDRESSES.map((address) => address.country));

  return LOCATIONS.filter((location) => held.has(slugOf(location.code))).map(
    (location) => ({
      value: slugOf(location.code),
      label: `${location.flag}  ${location.label}`,
    }),
  );
}

/*
 * The states, provinces, and cantons beneath them — one choice per distinct
 * `state`, scoped to its country. Sorted by label within a country so a
 * forty-nine-entry US list reads alphabetically rather than in address order.
 */
export function stateOptions(): SeedFieldOption[] {
  const byValue = new Map<string, SeedFieldOption & { country: string }>();

  for (const address of ADDRESSES) {
    if (byValue.has(address.state)) continue;
    byValue.set(address.state, {
      value: address.state,
      label: address.stateLabel,
      when: [address.country],
      country: address.country,
    });
  }

  const countryOrder = countryOptions().map((option) => option.value);

  return [...byValue.values()]
    .sort(
      (a, b) =>
        countryOrder.indexOf(a.country) - countryOrder.indexOf(b.country) ||
        a.label.localeCompare(b.label),
    )
    .map(({ country: _country, ...option }) => option);
}

// One line, as the dropdown prints it: street, suite, city — the state and
// postal code are already implied by the choice above it.
export function addressLabel(address: SeedAddress): string {
  return [address.line1, address.line2, address.city].filter(Boolean).join(', ');
}

// The address itself, scoped to its state.
export function addressOptions(): SeedFieldOption[] {
  return ADDRESSES.map((address) => ({
    value: address.value,
    label: addressLabel(address),
    when: [address.state],
  }));
}

// The full postal address, for anywhere that prints one rather than offering it.
export function formatAddress(address: SeedAddress): string {
  const street = [address.line1, address.line2].filter(Boolean).join(', ');
  return `${street}, ${address.city}, ${address.region} ${address.postalCode}`;
}

// --- Seeding ---------------------------------------------------------------

export async function seedLocations(prisma: PrismaClient): Promise<void> {
  for (const location of LOCATIONS) {
    await prisma.region.upsert({
      where: { code: location.code },
      create: { ...location, active: true },
      update: { label: location.label, flag: location.flag, active: true },
    });
  }

  console.info(
    `Locations seeded — ${LOCATIONS.length} countries, ` +
      `${stateOptions().length} states/regions, ${ADDRESSES.length} addresses. ` +
      'Manage them at /admin/settings.',
  );
}
