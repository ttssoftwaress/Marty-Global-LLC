import { z } from 'zod';

// The account-settings wire contract (AGENTS.md: Zod schemas are the source of
// truth). Passwords are not here — Better Auth owns password handling and serves
// its own change-password route (AGENTS.md, Auth: no custom password handling).

// Profile info. Name and email live on the Better Auth `user` row; phone is ours
// on the satellite profile record. The avatar is a separate upload step, so this
// payload carries the text fields only.
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.email(),
  // E.164-ish: digits with an optional leading +, or cleared to empty. Kept
  // permissive on separators — the field is free-text in the UI.
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^$|^\+?[\d\s()-]{6,}$/, 'Enter a valid phone number'),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Company details. `country` is an ISO 3166-1 alpha-2 code — the select resolves
// its label from the code, so the wire value is the code. `address` is surfaced
// as "Forwarding address": it is the destination the mail room forwards post to.
export const updateCompanySchema = z.object({
  businessName: z.string().trim().max(200),
  country: z.string().trim().length(2).toUpperCase(),
  industry: z.string().trim().max(120),
  address: z.string().trim().max(500),
});
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// Notification preferences: one master email gate plus five categories × three
// channels. The set is fixed by the UI, so the schema is explicit rather than a
// free-form record — an unknown category is a client bug, not data to store.
const channelPrefs = z.object({
  email: z.boolean(),
  inApp: z.boolean(),
  sms: z.boolean(),
});

export const updateNotificationPreferencesSchema = z.object({
  emailMaster: z.boolean(),
  categories: z.object({
    statusUpdates: channelPrefs,
    quoteAlerts: channelPrefs,
    documentRequests: channelPrefs,
    newMessages: channelPrefs,
    mailUpdates: channelPrefs,
  }),
});
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

/*
 * Setting the account's profile picture. The image itself went straight to R2
 * through `POST /v1/uploads` (AGENTS.md, Storage); this records the key it landed
 * under. A null key clears the picture back to initials.
 */
export const updateAvatarSchema = z.object({
  objectKey: z.string().trim().min(1).max(500).nullable(),
});
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
