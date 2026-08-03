import { z } from 'zod';

/*
 * Business settings — the wire contract for the reference data the rest of the
 * admin picks FROM (AGENTS.md: Zod schemas are the source of truth). Mirrors
 * `frontend/src/admin/types/settings.ts`.
 *
 * Two collections live here, and they are the same shape for the same reason:
 * both are a short, ordered, admin-curated list whose `code` is stored on other
 * rows. Locations are the jurisdictions services are offered in; carriers are
 * who the mail room ships with.
 *
 * `code` appears only on create. It is the value already recorded on every
 * order, region offering, and mail request pointing at the row, so it is
 * immutable once the row exists — the update schema simply has no code to send,
 * which makes renaming unrepresentable rather than a runtime check.
 */

/*
 * A location code: ISO 3166-1 alpha-2 where the location is a country ("US"),
 * and a short stable slug where it is not ("EU"). Upper-cased on the way in, so
 * "us" and "US" can never both exist as two rows meaning one place.
 */
export const locationCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9-]{1,11}$/,
    'Use 2–12 characters — letters, digits or hyphens, e.g. US or EU',
  );

/*
 * A carrier code. Lower-case kebab rather than the location's upper-case,
 * because it is a slug we choose ("royal-mail") rather than a published country
 * code — and keeping the two visibly different means a code is never pasted from
 * one list into the other by mistake.
 */
export const carrierCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9-]{1,31}$/,
    'Use lower-case letters, digits and hyphens, e.g. royal-mail',
  );

const label = z.string().trim().min(1).max(80);

/*
 * The flag emoji shown beside a location. Optional: a two-letter code derives
 * its own flag in the service, so registering a country is a one-field action.
 * Capped generously because a flag emoji is several code points (a regional
 * indicator pair is 8 UTF-16 units before any variation selector).
 */
const flag = z.string().trim().max(16);

const sortOrder = z.number().int().min(0).max(10_000);

export const createLocationSchema = z.object({
  code: locationCodeSchema,
  label,
  flag: flag.optional(),
  active: z.boolean().optional(),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = z
  .object({
    label: label.optional(),
    flag: flag.optional(),
    active: z.boolean().optional(),
    sortOrder: sortOrder.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const createCarrierSchema = z.object({
  code: carrierCodeSchema,
  label,
  active: z.boolean().optional(),
});
export type CreateCarrierInput = z.infer<typeof createCarrierSchema>;

export const updateCarrierSchema = z
  .object({
    label: label.optional(),
    active: z.boolean().optional(),
    sortOrder: sortOrder.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateCarrierInput = z.infer<typeof updateCarrierSchema>;

/*
 * Reordering, as one call carrying the complete list rather than a `sortOrder`
 * per row. The order is a property of the list, not of any row in it: sending
 * the whole sequence means two admins reordering at once can't interleave into a
 * ranking neither of them chose, and the service rewrites the positions in a
 * single transaction.
 */
export const reorderLocationsSchema = z.object({
  codes: z.array(locationCodeSchema).min(1).max(500),
});
export type ReorderLocationsInput = z.infer<typeof reorderLocationsSchema>;

export const reorderCarriersSchema = z.object({
  codes: z.array(carrierCodeSchema).min(1).max(500),
});
export type ReorderCarriersInput = z.infer<typeof reorderCarriersSchema>;

/*
 * Outbound email, on or off — the operational switch, not a customer preference
 * (that is `notifications.preferences.ts`, per account).
 *
 * `emailDisabledReason` is a note for the team, shown only in the admin panel:
 * a pause found days later needs to say why it is there. It is ignored when the
 * switch is turned back on — the service clears it rather than leaving a stale
 * explanation under a switch that is on again.
 */
export const updateNotificationSettingsSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    emailDisabledReason: z.string().trim().max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;
