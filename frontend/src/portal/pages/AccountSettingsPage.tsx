import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { useSession } from '@/auth/client';
import {
  acceptAttr,
  describeTypes,
  IMAGE_TYPES,
  isAcceptedType,
  MAX_BYTES,
} from '@/constants/uploads';
import { ApiError } from '@/services/api';
import { uploadFile } from '@/services/upload';
import { PortalLayout } from '../components/PortalLayout';
import {
  CompanyDetailsCard,
  EMPTY_NOTIFICATION_PREFERENCES,
  NotificationPreferencesCard,
  PasswordSecurityCard,
  ProfileInfoCard,
  SETTINGS_SECTIONS,
  SaveButton,
  SettingsMobileMenu,
  SettingsTabs,
  areNotificationPreferencesEqual,
  useCompanyDetails,
  useNotificationPreferences,
  useProfile,
  useUpdateAvatar,
  useUpdateCompanyDetails,
  useUpdateNotificationPreferences,
  useUpdateProfile,
} from '../features/settings';
import { PASSWORD_REQUIREMENTS } from '../features/settings/password-strength';
import { usePortalShell } from '../hooks/usePortalShell';
import type {
  CompanyDetails,
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
  PasswordChange,
  ProfileInfo,
  SettingsSection,
} from '../types/settings';

/*
 * Account settings — the Profile-info frame across all three viewports (one
 * responsive tree, Tailwind swaps the parts that differ):
 *
 *   - Desktop: two columns — a vertical tabs rail beside the profile panel.
 *   - Tablet: the same panel with a horizontal pill-tab row stacked above it.
 *   - Mobile: master → detail. The bare page is a full-screen menu list; tapping
 *     a row drills into that section's frame with a back-row and a sticky save
 *     bar. The drilled-in section lives in `?section=` so Back/deep-links work.
 *
 * All four sections are built — Profile info, Company details, Password &
 * security, and Notification preferences — each rendering its own card in the
 * same frame. The section defaults to Profile on tablet/desktop (there's always
 * a panel beside the tabs) and to the menu on mobile (nothing is drilled into
 * yet) — one `?section=` param reconciles both.
 *
 * Nothing is hardcoded customer data. Profile, company, and notification
 * preferences each load from and save to `/v1/profile*`; the session fills name
 * and email until the profile record resolves. Save unlocks only once a field
 * actually changes. Change-photo uploads straight to R2 and records the key.
 *
 * Password changes are deliberately not a `/v1/profile` route — Better Auth owns
 * password handling and serves its own endpoint (AGENTS.md, Auth).
 */

const SETTINGS_ROUTE = '/app/settings';

// Mirrors what the uploads endpoint enforces for an avatar. Checked here so the
// customer is told before anything is sent; the backend is the boundary.
const AVATAR_MAX_BYTES = MAX_BYTES.avatar;
const AVATAR_MAX_MB = AVATAR_MAX_BYTES / (1024 * 1024);

function isSettingsSection(value: string | null): value is SettingsSection {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

function ComingSoonPanel({ label, bare }: { label: string; bare?: boolean }) {
  const shell = bare
    ? 'flex w-full flex-col items-center gap-2 py-16 text-center'
    : 'flex w-full flex-1 flex-col items-center gap-2 rounded-card border border-gray-200 bg-white px-6 py-16 text-center';
  return (
    <div className={shell}>
      <p className="text-body-lg font-semibold text-text">{label}</p>
      <p className="max-w-[26.25rem] text-body text-gray-500">
        This section is being built. Your profile info is ready to edit now.
      </p>
    </div>
  );
}

export function AccountSettingsPage() {
  const { user, onLogout } = usePortalShell();
  const { data: session } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  // `?section=` selects the active section. Absent, tablet/desktop default to
  // Profile (a panel always sits beside the tabs) while mobile stays on the menu
  // (nothing drilled in) — the null case drives both.
  const sectionParam = searchParams.get('section');
  const activeSection: SettingsSection = isSettingsSection(sectionParam)
    ? sectionParam
    : 'profile';
  // Mobile shows the menu until a section is explicitly chosen.
  const mobileDrilledIn = isSettingsSection(sectionParam);

  const selectSection = (section: SettingsSection) => {
    setSearchParams({ section }, { replace: false });
  };

  const openMobileMenu = () => {
    setSearchParams({}, { replace: false });
  };

  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const updateAvatar = useUpdateAvatar();

  // The avatar picker is shared by the mobile and desktop renders of the profile
  // card, so it lives here rather than inside either of them.
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Seed from the profile record; the session fills name/email until it
  // resolves, so the fields are never blank on first paint. Re-seeds whenever
  // either source settles.
  const initial = useMemo<ProfileInfo>(
    () => ({
      fullName: profileQuery.data?.fullName ?? session?.user.name ?? '',
      email: profileQuery.data?.email ?? session?.user.email ?? '',
      phone: profileQuery.data?.phone ?? '',
      avatarUrl: profileQuery.data?.avatarUrl,
    }),
    [profileQuery.data, session?.user.name, session?.user.email],
  );

  const [form, setForm] = useState<ProfileInfo>(initial);
  useEffect(() => setForm(initial), [initial]);

  const setField = (field: 'fullName' | 'email' | 'phone', next: string) =>
    setForm((prev) => ({ ...prev, [field]: next }));

  // Save unlocks only once something actually changed from the seeded values.
  const isDirty =
    form.fullName !== initial.fullName ||
    form.email !== initial.email ||
    form.phone !== initial.phone;

  const onSave = () => {
    updateProfile.mutate({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
    });
  };

  const onCancel = () => setForm(initial);

  /*
   * Changing the photo opens a picker, uploads the image straight to R2, and
   * records the resulting key — the bytes never round-trip through the API
   * (AGENTS.md, Storage). The input lives on the page rather than in the card so
   * both the mobile and desktop renders of that card share one picker.
   */
  const onChangePhoto = () => avatarInputRef.current?.click();

  const onAvatarPicked = async (file: File | undefined) => {
    if (!file) return;

    // Type as well as size: a phone camera roll happily offers a HEIC through
    // the picker, which the endpoint refuses — better to say so here.
    if (!isAcceptedType(file, IMAGE_TYPES)) {
      setAvatarError(`Use a ${describeTypes(IMAGE_TYPES)} image.`);
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(`That image is larger than ${AVATAR_MAX_MB} MB.`);
      return;
    }

    setAvatarError(null);
    setIsUploadingAvatar(true);

    try {
      const uploaded = await uploadFile(file, 'avatar');
      await updateAvatar.mutateAsync(uploaded.objectKey);
    } catch (error) {
      setAvatarError(
        error instanceof ApiError
          ? error.message
          : 'That photo could not be uploaded. Try again.',
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const companyQuery = useCompanyDetails();
  const updateCompany = useUpdateCompanyDetails();

  // Company details seed from the record. A customer without a company yet gets
  // empty fields (the backend returns them rather than a 404), with the country
  // select defaulting to US so it always has a valid selection.
  const initialCompany = useMemo<CompanyDetails>(
    () => ({
      businessName: companyQuery.data?.businessName ?? '',
      country: companyQuery.data?.country || 'US',
      industry: companyQuery.data?.industry ?? '',
      address: companyQuery.data?.address ?? '',
    }),
    [companyQuery.data],
  );

  const [company, setCompany] = useState<CompanyDetails>(initialCompany);
  useEffect(() => setCompany(initialCompany), [initialCompany]);

  const setCompanyField = (field: keyof CompanyDetails, next: string) =>
    setCompany((prev) => ({ ...prev, [field]: next }));

  const isCompanyDirty =
    company.businessName !== initialCompany.businessName ||
    company.country !== initialCompany.country ||
    company.industry !== initialCompany.industry ||
    company.address !== initialCompany.address;

  const onSaveCompany = () => {
    updateCompany.mutate(company);
  };

  const onCancelCompany = () => setCompany(initialCompany);

  // Password & security — a change-password form, so it seeds empty (no record to
  // load). Update unlocks only when the current password is present, the new one
  // meets every requirement, and the confirmation matches.
  const emptyPassword: PasswordChange = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  const [password, setPassword] = useState<PasswordChange>(emptyPassword);

  const setPasswordField = (field: keyof PasswordChange, next: string) =>
    setPassword((prev) => ({ ...prev, [field]: next }));

  const canUpdatePassword =
    password.currentPassword.length > 0 &&
    PASSWORD_REQUIREMENTS.every((rule) => rule.met(password.newPassword)) &&
    password.newPassword === password.confirmPassword;

  const onSavePassword = () => {
    // Wires to the Better Auth change-password call once the endpoint lands.
  };

  const onCancelPassword = () => setPassword(emptyPassword);

  const notificationsQuery = useNotificationPreferences();
  const updateNotifications = useUpdateNotificationPreferences();

  // Seeds all-off until the record resolves, so no channel is shown as on before
  // the customer's real preferences arrive.
  const initialNotifications = useMemo<NotificationPreferences>(
    () => notificationsQuery.data ?? EMPTY_NOTIFICATION_PREFERENCES,
    [notificationsQuery.data],
  );

  const [notifications, setNotifications] = useState<NotificationPreferences>(
    initialNotifications,
  );
  useEffect(() => setNotifications(initialNotifications), [initialNotifications]);

  const toggleNotificationMaster = (next: boolean) =>
    setNotifications((prev) => ({ ...prev, emailMaster: next }));

  const toggleNotificationChannel = (
    category: NotificationCategory,
    channel: NotificationChannel,
    next: boolean,
  ) =>
    setNotifications((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: { ...prev.categories[category], [channel]: next },
      },
    }));

  const isNotificationsDirty = !areNotificationPreferencesEqual(
    notifications,
    initialNotifications,
  );

  const onSaveNotifications = () => {
    updateNotifications.mutate(notifications);
  };

  const onCancelNotifications = () => setNotifications(initialNotifications);

  const activeLabel =
    SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.label ??
    'Profile info';

  const isProfile = activeSection === 'profile';
  const isCompany = activeSection === 'company';
  const isSecurity = activeSection === 'security';
  const isNotifications = activeSection === 'notifications';

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      {/* ---------- Mobile: menu list (master) ---------- */}
      {!mobileDrilledIn && (
        <div className="w-full px-4 py-6 md:hidden">
          <div className="flex flex-col gap-4">
            <h1 className="text-h3 font-semibold text-text">Account settings</h1>
            <SettingsMobileMenu onSelect={selectSection} />
          </div>
        </div>
      )}

      {/* ---------- Mobile: drilled-in section (detail) ---------- */}
      {mobileDrilledIn && (
        <div className="w-full md:hidden">
          <div
            className={`flex flex-col gap-4 px-4 pt-4 ${
              isProfile ? 'gap-6 pb-[6.25rem]' : 'pb-6'
            }`}
          >
            <button
              type="button"
              onClick={openMobileMenu}
              className="flex items-center gap-2 self-start text-[0.875rem] font-medium text-text-secondary"
            >
              <ArrowLeft className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Account settings
            </button>

            <h1 className="text-h4 font-semibold text-text">{activeLabel}</h1>

            {isProfile && (
              <ProfileInfoCard
                value={form}
                onChange={setField}
                onChangePhoto={onChangePhoto}
                isUploadingPhoto={isUploadingAvatar || updateAvatar.isPending}
                photoError={avatarError}
                onCancel={onCancel}
                onSave={onSave}
                canSave={isDirty}
                bare
              />
            )}

            {/* Company details drills into its own card, followed by an inline
                action bar (matching the mobile design — a bordered card, not a
                fixed bottom bar). */}
            {isCompany && (
              <>
                <div className="rounded-card border border-gray-200 bg-white p-4">
                  <CompanyDetailsCard
                    value={company}
                    onChange={setCompanyField}
                    onCancel={onCancelCompany}
                    onSave={onSaveCompany}
                    canSave={isCompanyDirty}
                    bare
                  />
                </div>
                <div className="flex items-center justify-between rounded-card border border-gray-200 bg-white p-4">
                  <button
                    type="button"
                    onClick={onCancelCompany}
                    className="px-4 py-3 text-[0.875rem] font-semibold text-text-secondary"
                  >
                    Cancel
                  </button>
                  <SaveButton
                    onClick={onSaveCompany}
                    disabled={!isCompanyDirty}
                    isSaving={false}
                  />
                </div>
              </>
            )}

            {/* Password & security drills into its own card, followed by the same
                inline action bar the mobile design uses (a bordered card, not a
                fixed bottom bar). */}
            {isSecurity && (
              <>
                <div className="rounded-card border border-gray-200 bg-white p-4">
                  <PasswordSecurityCard
                    value={password}
                    onChange={setPasswordField}
                    onCancel={onCancelPassword}
                    onSave={onSavePassword}
                    canSave={canUpdatePassword}
                    bare
                  />
                </div>
                <div className="flex items-center justify-between rounded-card border border-gray-200 bg-white p-4">
                  <button
                    type="button"
                    onClick={onCancelPassword}
                    className="px-4 py-3 text-[0.875rem] font-semibold text-text-secondary"
                  >
                    Cancel
                  </button>
                  <SaveButton
                    onClick={onSavePassword}
                    disabled={!canUpdatePassword}
                    isSaving={false}
                    label="Update password"
                    savingLabel="Updating…"
                  />
                </div>
              </>
            )}

            {/* Notification preferences keeps its card chrome on mobile (the
                design draws the matrix inside the panel card) and carries its
                own footer inside that card, so it renders un-bare here. */}
            {isNotifications && (
              <NotificationPreferencesCard
                value={notifications}
                onToggleMaster={toggleNotificationMaster}
                onToggleChannel={toggleNotificationChannel}
                onCancel={onCancelNotifications}
                onSave={onSaveNotifications}
                canSave={isNotificationsDirty}
              />
            )}

            {!isProfile && !isCompany && !isSecurity && !isNotifications && (
              <ComingSoonPanel label={activeLabel} bare />
            )}
          </div>

          {/* Sticky save bar — only for the editable Profile frame. */}
          {isProfile && (
            <div className="fixed inset-x-0 bottom-0 z-20 flex h-[4.5rem] items-center justify-between border-t border-gray-200 bg-white px-4">
              <button
                type="button"
                onClick={onCancel}
                className="text-[0.875rem] font-medium text-text-secondary"
              >
                Cancel
              </button>
              <SaveButton
                onClick={onSave}
                disabled={!isDirty}
                isSaving={false}
                className="w-[15rem]"
              />
            </div>
          )}
        </div>
      )}

      {/* ---------- Tablet & desktop ---------- */}
      <div className="hidden w-full p-6 md:block lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 lg:gap-8">
          <header className="flex w-full flex-col gap-1.5">
            <p className="flex items-center gap-2 text-caption font-medium uppercase tracking-[0.4px]">
              <Link to="/app" className="text-primary hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500">Account settings</span>
            </p>
            <h1 className="text-[2rem] font-semibold leading-10 text-text">
              Account settings
            </h1>
            <p className="text-[0.875rem] text-text-secondary">
              Manage your profile, company details, security, and notification
              preferences.
            </p>
          </header>

          {/* Desktop puts the tabs beside the panel; tablet stacks them. */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
            <SettingsTabs active={activeSection} onSelect={selectSection} />

            {isProfile && (
              <ProfileInfoCard
                value={form}
                onChange={setField}
                onChangePhoto={onChangePhoto}
                isUploadingPhoto={isUploadingAvatar || updateAvatar.isPending}
                photoError={avatarError}
                onCancel={onCancel}
                onSave={onSave}
                canSave={isDirty}
              />
            )}

            {isCompany && (
              <CompanyDetailsCard
                value={company}
                onChange={setCompanyField}
                onCancel={onCancelCompany}
                onSave={onSaveCompany}
                canSave={isCompanyDirty}
              />
            )}

            {isSecurity && (
              <PasswordSecurityCard
                value={password}
                onChange={setPasswordField}
                onCancel={onCancelPassword}
                onSave={onSavePassword}
                canSave={canUpdatePassword}
              />
            )}

            {isNotifications && (
              <NotificationPreferencesCard
                value={notifications}
                onToggleMaster={toggleNotificationMaster}
                onToggleChannel={toggleNotificationChannel}
                onCancel={onCancelNotifications}
                onSave={onSaveNotifications}
                canSave={isNotificationsDirty}
              />
            )}

            {!isProfile && !isCompany && !isSecurity && !isNotifications && (
              <ComingSoonPanel label={activeLabel} />
            )}
          </div>
        </div>
      </div>

      {/* One picker for both renders of the profile card (mobile drill-in and
          tablet/desktop panel), so neither owns the other's input. */}
      <input
        ref={avatarInputRef}
        type="file"
        accept={acceptAttr(IMAGE_TYPES)}
        className="sr-only"
        aria-label="Upload a profile photo"
        onChange={(event) => {
          void onAvatarPicked(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </PortalLayout>
  );
}
