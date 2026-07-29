import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  CompanyDetails,
  CompanyDetailsUpdate,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  ProfileInfo,
  ProfileInfoUpdate,
} from '../../types/settings';

/*
 * Account-settings data layer. Three read/write pairs, all scoped to the
 * signed-in customer by the backend — no id is ever sent, the session decides
 * whose record is read.
 *
 * Passwords are deliberately absent: Better Auth owns password handling and
 * serves its own change-password route (AGENTS.md, Auth), so the security frame
 * calls the auth client rather than this module.
 *
 * Each mutation seeds the query cache with the response it gets back, so the
 * form re-seeds from the saved record without a second round trip.
 */

export const profileKey = () => ['settings', 'profile'] as const;
export const companyKey = () => ['settings', 'company'] as const;
export const notificationPreferencesKey = () =>
  ['settings', 'notification-preferences'] as const;

// GET /v1/profile — name and email from the account, phone and avatar from the
// customer's profile record.
export function useProfile() {
  return useQuery({
    queryKey: profileKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<ProfileInfo>>('/profile').then((res) => res.data),
  });
}

// PATCH /v1/profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: ProfileInfoUpdate) =>
      apiFetch<ApiSuccess<ProfileInfo>>('/profile', {
        method: 'PATCH',
        body: JSON.stringify(update),
      }).then((res) => res.data),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey(), profile);
    },
  });
}

// GET /v1/profile/company — the customer's single company record. A customer
// without one yet gets empty fields rather than an error.
export function useCompanyDetails() {
  return useQuery({
    queryKey: companyKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<CompanyDetails>>('/profile/company').then(
        (res) => res.data,
      ),
  });
}

// PATCH /v1/profile/company
export function useUpdateCompanyDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: CompanyDetailsUpdate) =>
      apiFetch<ApiSuccess<CompanyDetails>>('/profile/company', {
        method: 'PATCH',
        body: JSON.stringify(update),
      }).then((res) => res.data),
    onSuccess: (company) => {
      queryClient.setQueryData(companyKey(), company);
    },
  });
}

// GET /v1/profile/notification-preferences — the master email gate plus each
// category's three channel switches.
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationPreferencesKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<NotificationPreferences>>(
        '/profile/notification-preferences',
      ).then((res) => res.data),
  });
}

// PATCH /v1/profile/notification-preferences
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: NotificationPreferencesUpdate) =>
      apiFetch<ApiSuccess<NotificationPreferences>>(
        '/profile/notification-preferences',
        { method: 'PATCH', body: JSON.stringify(update) },
      ).then((res) => res.data),
    onSuccess: (preferences) => {
      queryClient.setQueryData(notificationPreferencesKey(), preferences);
    },
  });
}

/*
 * PUT /v1/profile/avatar — set or clear the account's profile picture.
 *
 * The image itself was uploaded straight to R2 through `services/upload.ts`; the
 * body carries only the object key (AGENTS.md, Storage). The response is the
 * refreshed profile, including a freshly presigned `avatarUrl`, so it is written
 * straight into the cache rather than triggering a second fetch.
 */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (objectKey: string | null) =>
      apiFetch<ApiSuccess<ProfileInfo>>('/profile/avatar', {
        method: 'PUT',
        body: JSON.stringify({ objectKey }),
      }).then((res) => res.data),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey(), profile);
    },
  });
}
