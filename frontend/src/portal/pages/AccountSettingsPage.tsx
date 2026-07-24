import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { useSession } from '@/auth/client';
import { PortalLayout } from '../components/PortalLayout';
import {
  CompanyDetailsCard,
  PasswordSecurityCard,
  ProfileInfoCard,
  SETTINGS_SECTIONS,
  SaveButton,
  SettingsMobileMenu,
  SettingsTabs,
} from '../features/settings';
import { PASSWORD_REQUIREMENTS } from '../features/settings/password-strength';
import { usePortalShell } from '../hooks/usePortalShell';
import type {
  CompanyDetails,
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
 * Only Profile info is built; the other three sections show a "coming soon"
 * panel in the same frame. The section defaults to Profile on tablet/desktop
 * (there's always a panel beside the tabs) and to the menu on mobile (nothing is
 * drilled into yet) — one `?section=` param reconciles both.
 *
 * Nothing is hardcoded customer data: name and email seed from the session,
 * phone from the profile record once its endpoint lands (two-apps sync rule).
 * Save/Change-photo handlers are in place for those mutations; Save unlocks only
 * once a field actually changes.
 */

const SETTINGS_ROUTE = '/app/settings';

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
      <p className="max-w-[420px] text-body text-gray-500">
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

  // Seed values: session for name/email; phone/avatar await the profile
  // endpoint. Re-seeds if the session resolves after first paint.
  const initial = useMemo<ProfileInfo>(
    () => ({
      fullName: session?.user.name ?? '',
      email: session?.user.email ?? '',
      phone: '',
      avatarUrl: undefined,
    }),
    [session?.user.name, session?.user.email],
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
    // Wires to the update-profile mutation once the endpoint lands.
  };

  const onCancel = () => setForm(initial);

  const onChangePhoto = () => {
    // Wires to the avatar upload flow once R2 upload lands.
  };

  // Company details seed empty until the company-record endpoint lands; the
  // fields render whatever the page holds, so real data slots straight in.
  const initialCompany = useMemo<CompanyDetails>(
    () => ({ businessName: '', country: 'US', industry: '', address: '' }),
    [],
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
    // Wires to the update-company mutation once the endpoint lands.
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

  const activeLabel =
    SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.label ??
    'Profile info';

  const isProfile = activeSection === 'profile';
  const isCompany = activeSection === 'company';
  const isSecurity = activeSection === 'security';

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
              isProfile ? 'gap-6 pb-[100px]' : 'pb-6'
            }`}
          >
            <button
              type="button"
              onClick={openMobileMenu}
              className="flex items-center gap-2 self-start text-[14px] font-medium text-text-secondary"
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
                    className="px-4 py-3 text-[14px] font-semibold text-text-secondary"
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
                    className="px-4 py-3 text-[14px] font-semibold text-text-secondary"
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

            {!isProfile && !isCompany && !isSecurity && (
              <ComingSoonPanel label={activeLabel} bare />
            )}
          </div>

          {/* Sticky save bar — only for the editable Profile frame. */}
          {isProfile && (
            <div className="fixed inset-x-0 bottom-0 z-20 flex h-[72px] items-center justify-between border-t border-gray-200 bg-white px-4">
              <button
                type="button"
                onClick={onCancel}
                className="text-[14px] font-medium text-text-secondary"
              >
                Cancel
              </button>
              <SaveButton
                onClick={onSave}
                disabled={!isDirty}
                isSaving={false}
                className="w-[240px]"
              />
            </div>
          )}
        </div>
      )}

      {/* ---------- Tablet & desktop ---------- */}
      <div className="hidden w-full p-6 md:block lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:gap-8">
          <header className="flex w-full flex-col gap-1.5">
            <p className="flex items-center gap-2 text-caption font-medium uppercase tracking-[0.4px]">
              <Link to="/app" className="text-primary hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500">Account settings</span>
            </p>
            <h1 className="text-[32px] font-semibold leading-10 text-text">
              Account settings
            </h1>
            <p className="text-[14px] text-text-secondary">
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

            {!isProfile && !isCompany && !isSecurity && (
              <ComingSoonPanel label={activeLabel} />
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
