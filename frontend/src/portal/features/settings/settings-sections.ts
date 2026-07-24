import { Bell, Building2, ShieldCheck, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { SettingsSection } from '../../types/settings';

/*
 * The four account-settings sections, in the order the design lists them. One
 * definition drives every viewport: the desktop vertical rail, the tablet pill
 * row, and the mobile menu list all map over this array so the label, icon, and
 * order stay in sync in one place.
 *
 * Icons are read from the Figma design for intent only and mapped to the house
 * lucide-react set (Design guide.md): user, building, shield (the mobile menu
 * shows a lock for the same "Password & security" row — same intent, one icon
 * here), bell.
 */

export type SettingsSectionDef = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
};

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: 'profile', label: 'Profile info', icon: User },
  { id: 'company', label: 'Company details', icon: Building2 },
  { id: 'security', label: 'Password & security', icon: ShieldCheck },
  { id: 'notifications', label: 'Notification preferences', icon: Bell },
];
