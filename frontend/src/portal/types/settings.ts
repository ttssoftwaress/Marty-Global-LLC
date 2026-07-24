/*
 * Account-settings wire shapes — the local mirror of what the backend will
 * return for the settings screens (two-apps sync rule: the backend owns the
 * contract, the frontend mirrors it here). Only the Profile-info frame is built
 * for now; the other sections are declared so the tab set is typed in one place.
 */

export type SettingsSection =
  | 'profile'
  | 'company'
  | 'security'
  | 'notifications';

// The customer's profile as edited on the Profile-info frame. Name/email arrive
// from the session; phone and avatar come from the profile record once the
// endpoint lands.
export type ProfileInfo = {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
};

// What the form POSTs back on Save. The photo is a separate upload step, so the
// text fields are all this payload carries.
export type ProfileInfoUpdate = {
  fullName: string;
  email: string;
  phone: string;
};

// The customer's company as edited on the Company-details frame. All four fields
// arrive from the company record once its endpoint lands; the country is stored
// as a code so the select can resolve its label.
export type CompanyDetails = {
  businessName: string;
  country: string;
  industry: string;
  address: string;
};

// What the Company-details form POSTs back on Save — the same four fields.
export type CompanyDetailsUpdate = CompanyDetails;

// The Password & security frame's live form state. Nothing here is seeded from a
// record — it's a change-password form, so all three fields start empty and the
// strength meter / requirement checks derive from what the user types.
export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// What the change-password form POSTs back on Save. The current password proves
// possession; the new password is set server-side via Better Auth. The confirm
// field is a client-only guard, so it isn't part of the wire payload.
export type PasswordChangeUpdate = {
  currentPassword: string;
  newPassword: string;
};
