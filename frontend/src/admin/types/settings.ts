/*
 * Business settings — local mirror of the API shapes the "Admin settings" screen
 * renders and its forms submit (AGENTS.md, two-apps sync rule; the backend owns
 * this data).
 *
 * Two collections, the same shape for the same reason: both are a short,
 * ordered, admin-curated list whose `code` is stored on other rows.
 *
 *   - Locations are the jurisdictions services are offered in. They fill the
 *     catalog's coverage picker, the orders queue's region filter, and the chip
 *     on a customer's row.
 *   - Carriers are who the mail room ships with, offered by the forwarding form.
 *
 * Both used to exist only because a seed script inserted them, which made
 * opening a country a code change. Nothing seeds them now — this screen is where
 * they come from.
 */

/*
 * What already points at a location. Rendered as the "Used by" column, and the
 * reason a location in use is turned off rather than removed: an order filed
 * under it is a filing, and filings are retained.
 */
export type LocationUsage = {
  services: number;
  pricingTiers: number;
  orders: number;
};

export type AdminLocation = {
  // ISO 3166-1 alpha-2 where the location is a country ("US"), a short stable
  // slug where it is not ("EU"). Immutable — other rows store it — so the edit
  // form shows it read-only.
  code: string;
  label: string;
  // The flag emoji. Derived from a two-letter code by the backend when the admin
  // leaves it blank, so registering a country is a one-field action.
  flag: string;
  // Off closes the location to new orders and drops it from every picker, while
  // leaving it resolvable on the records that already reference it.
  active: boolean;
  sortOrder: number;
  updatedAt: string;
  usage: LocationUsage;
  // Whether a hard delete is available. Resolved by the backend rather than
  // re-derived from the counts here, so the rule has one definition.
  canDelete: boolean;
};

export type CarrierUsage = { shipments: number };

export type AdminCarrier = {
  code: string;
  label: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
  usage: CarrierUsage;
  canDelete: boolean;
};

// --- Write payloads ------------------------------------------------------
// `code` appears on create only: it is what other rows store, so renaming one
// would detach every record already pointing at it.

export type LocationCreatePayload = {
  code: string;
  label: string;
  flag?: string;
  active?: boolean;
};

export type LocationUpdatePayload = {
  label?: string;
  flag?: string;
  active?: boolean;
  sortOrder?: number;
};

export type CarrierCreatePayload = {
  code: string;
  label: string;
  active?: boolean;
};

export type CarrierUpdatePayload = {
  label?: string;
  active?: boolean;
  sortOrder?: number;
};

// --- Form drafts ---------------------------------------------------------
// Every draft field is a string, because that is what an input holds. The
// payload builders below convert once, at submit.

export type LocationDraft = {
  code: string;
  label: string;
  flag: string;
  active: boolean;
};

export type CarrierDraft = {
  code: string;
  label: string;
  active: boolean;
};

export type SettingsFormErrors = Partial<Record<'code' | 'label', string>>;
