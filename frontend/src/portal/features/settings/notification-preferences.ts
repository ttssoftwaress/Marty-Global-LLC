import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
} from '../../types/settings';

/*
 * The notification matrix's shape — its three delivery channels and four
 * categories, in the order the design lists them. One definition drives every
 * viewport: the column headers, the master row, and each category row all map
 * over these arrays, so labels and order stay in sync in one place.
 *
 * Copy follows the desktop link (Design guide.md: desktop is the source of truth
 * for wording where the three designs differ — the mobile frame's "made for
 * review" is treated as a design artifact).
 */

export type NotificationChannelDef = {
  id: NotificationChannel;
  /* The uppercase column header. */
  label: string;
  /* Spoken form used to name each switch for screen readers. */
  spokenLabel: string;
};

export const NOTIFICATION_CHANNELS: NotificationChannelDef[] = [
  { id: 'email', label: 'EMAIL', spokenLabel: 'email' },
  { id: 'inApp', label: 'IN-APP', spokenLabel: 'in-app' },
  { id: 'sms', label: 'SMS', spokenLabel: 'SMS' },
];

export type NotificationCategoryDef = {
  id: NotificationCategory;
  label: string;
  description: string;
};

export const NOTIFICATION_CATEGORIES: NotificationCategoryDef[] = [
  {
    id: 'statusUpdates',
    label: 'Status updates',
    description: 'Get real-time updates on active operations',
  },
  {
    id: 'quoteAlerts',
    label: 'Quote alerts',
    description: 'When pricing quotes are ready for review',
  },
  {
    id: 'documentRequests',
    label: 'Document requests',
    description: 'Alerts when your submission needs documents',
  },
  {
    id: 'newMessages',
    label: 'New messages',
    description: 'Notification of directly sent workspace chat',
  },
  {
    id: 'mailUpdates',
    label: 'Virtual mail',
    description: 'When post is scanned in or a mail request is completed',
  },
];

// The master row above the categories — email delivery account-wide.
export const NOTIFICATION_MASTER = {
  label: 'Email notifications',
  description: 'Receive email notifications for important updates',
};

/*
 * The neutral starting record: nothing enabled. The real values arrive from the
 * preferences endpoint once it lands — this is only what the form holds before
 * that response resolves, so no channel is presumed on.
 */
export const EMPTY_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailMaster: false,
  categories: NOTIFICATION_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.id] = { email: false, inApp: false, sms: false };
      return acc;
    },
    {} as NotificationPreferences['categories'],
  ),
};

// Structural equality for the dirty check — the record is small and fixed, so a
// field walk is clearer here than serialising it.
export function areNotificationPreferencesEqual(
  a: NotificationPreferences,
  b: NotificationPreferences,
): boolean {
  if (a.emailMaster !== b.emailMaster) return false;
  return NOTIFICATION_CATEGORIES.every((category) =>
    NOTIFICATION_CHANNELS.every(
      (channel) =>
        a.categories[category.id][channel.id] ===
        b.categories[category.id][channel.id],
    ),
  );
}
