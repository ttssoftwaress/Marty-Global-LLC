/*
 * WHERE WE OPERATE — the marketing mirror of the backend's address book.
 *
 * The backend derives its regions, its country → state → address dropdowns, and
 * formation/agent coverage from one table (`prisma/seed-locations.ts`). Marketing
 * cannot import it (AGENTS.md: nothing is shared between the apps), so this is
 * the local copy — at COUNTRY and STATE level only.
 *
 * Street addresses are deliberately absent. A public page listing the exact
 * desks we hold is an invitation to have them used by people who never became
 * customers, and the customer gets their real address on the order anyway.
 *
 * Two caveats worth keeping in mind when this changes:
 *   - The live list is ADMIN-MANAGED (`/admin/settings` → Locations). This file
 *     mirrors the seeded starting set, so it needs updating by hand when the
 *     team adds or retires a location.
 *   - The counts below are derived, never typed. "46 states" is what the data
 *     says; if someone edits the arrays, every figure on the site follows.
 */

export type CoverageCountry = {
  code: string;
  label: string;
  flag: string;
  /** States, provinces, cantons, or city-regions — whatever that country's middle rung is. */
  areas: string[];
};

// US entries that are not states, so the headline figure can say "46 states plus
// DC, Guam and Puerto Rico" instead of overstating.
const US_NON_STATES = ['District of Columbia', 'Guam', 'Puerto Rico'];

export const COVERAGE: CoverageCountry[] = [
  {
    code: 'US',
    label: 'United States',
    flag: '🇺🇸',
    areas: [
      'Alabama',
      'Alaska',
      'Arizona',
      'California',
      'Colorado',
      'Delaware',
      'District of Columbia',
      'Florida',
      'Georgia',
      'Guam',
      'Hawaii',
      'Illinois',
      'Indiana',
      'Iowa',
      'Kansas',
      'Kentucky',
      'Louisiana',
      'Maine',
      'Maryland',
      'Massachusetts',
      'Michigan',
      'Minnesota',
      'Mississippi',
      'Missouri',
      'Nebraska',
      'Nevada',
      'New Hampshire',
      'New Jersey',
      'New Mexico',
      'New York',
      'North Carolina',
      'North Dakota',
      'Ohio',
      'Oklahoma',
      'Oregon',
      'Pennsylvania',
      'Puerto Rico',
      'Rhode Island',
      'South Carolina',
      'South Dakota',
      'Tennessee',
      'Texas',
      'Utah',
      'Vermont',
      'Virginia',
      'Washington',
      'West Virginia',
      'Wisconsin',
      'Wyoming',
    ],
  },
  { code: 'CA', label: 'Canada', flag: '🇨🇦', areas: ['Ontario'] },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧', areas: ['Greater London'] },
  { code: 'IE', label: 'Ireland', flag: '🇮🇪', areas: ['County Longford'] },
  { code: 'NL', label: 'Netherlands', flag: '🇳🇱', areas: ['Noord-Holland'] },
  { code: 'ES', label: 'Spain', flag: '🇪🇸', areas: ['Madrid'] },
  { code: 'IT', label: 'Italy', flag: '🇮🇹', areas: ['Venice (Veneto)'] },
  { code: 'AT', label: 'Austria', flag: '🇦🇹', areas: ['Vienna'] },
  { code: 'CH', label: 'Switzerland', flag: '🇨🇭', areas: ['Vaud'] },
  { code: 'SG', label: 'Singapore', flag: '🇸🇬', areas: ['Central Singapore'] },
  { code: 'TW', label: 'Taiwan', flag: '🇹🇼', areas: ['Taoyuan City'] },
  { code: 'BR', label: 'Brazil', flag: '🇧🇷', areas: ['Paraná'] },
];

export const COUNTRY_COUNT = COVERAGE.length;

const US = COVERAGE.find((country) => country.code === 'US');

export const US_STATE_COUNT =
  US?.areas.filter((area) => !US_NON_STATES.includes(area)).length ?? 0;

/** "46 US states" — the phrase every page uses, derived so it cannot drift. */
export const US_STATES_LABEL = `${US_STATE_COUNT} US states`;

/** The one-line coverage summary shared by the geography-bound services. */
export const COVERAGE_SUMMARY = `${US_STATES_LABEL} plus DC, Guam & Puerto Rico, and ${COUNTRY_COUNT - 1} more countries`;
