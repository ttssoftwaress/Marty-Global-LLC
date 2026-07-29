import { useState } from 'react';
import { Info } from 'lucide-react';

import { Role } from '@/constants/roles';
import { AdminLayout } from '../components/AdminLayout';
import { CarriersPanel } from '../features/settings/CarriersPanel';
import { LocationsPanel } from '../features/settings/LocationsPanel';
import { useAdminShell } from '../hooks/useAdminShell';
import { useAdminMe } from '../queries/admin-me';

/*
 * Admin settings — the reference data the rest of the admin picks FROM.
 *
 * This screen exists because that data used to have no home. Locations and mail
 * carriers were rows a seed script inserted, which made "which countries do we
 * operate in" a code change and left `db:reset` wiping a list nobody could put
 * back from the app. Nothing seeds them now: these two panels are where they
 * come from, and where they are retired.
 *
 * Two tabs rather than two routes, for the same reason the field registry pairs
 * its two halves: both are org-wide reference lists an admin moves between while
 * setting the business up, and separate URLs would turn that into navigation.
 *
 * Reading takes the `settings` area; writing is admin-only on the backend, so a
 * staff member holding the area sees the lists without the controls that would
 * 403 on them. `canWrite` is convenience — the server is the boundary.
 *
 * No Figma link — built to the written brief in the same card, table, and tab
 * language as the designed admin screens, and logged as a deviation.
 */

type SettingsTab = 'locations' | 'carriers';

const TABS: { value: SettingsTab; label: string }[] = [
  { value: 'locations', label: 'Locations' },
  { value: 'carriers', label: 'Mail carriers' },
];

export function AdminSettingsPage() {
  const { user, onLogout } = useAdminShell();
  const me = useAdminMe();
  const [tab, setTab] = useState<SettingsTab>('locations');

  const canWrite = me.data?.role === Role.ADMIN;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 md:gap-6">
          <header className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-h4 font-semibold text-text lg:text-h3">
                Admin settings
              </h1>
              <p className="text-body text-text-secondary lg:max-w-[45rem]">
                The lists every other section picks from. Change one here and it
                changes everywhere it is shown — no deploy, no database script.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Settings"
              className="flex w-fit items-center gap-1 rounded-input bg-gray-100 p-1"
            >
              {TABS.map((option) => {
                const active = option.value === tab;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(option.value)}
                    className={`whitespace-nowrap rounded-[0.5rem] px-4 py-2 text-[0.8125rem] font-semibold transition-colors ${
                      active
                        ? 'bg-white text-text shadow-sm-elevation'
                        : 'text-gray-500 hover:text-text'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* A read-only visitor gets told why the controls are missing, rather
              than being left to wonder whether the screen failed to load. */}
          {me.isSuccess && !canWrite && (
            <p className="flex items-start gap-2 rounded-card border border-gray-200 bg-gray-50 px-4 py-3 text-body text-text-secondary">
              <Info
                className="mt-0.5 size-4 shrink-0 text-gray-500"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              You can view these lists but not change them — editing them is
              restricted to admins.
            </p>
          )}

          {tab === 'locations' ? (
            <LocationsPanel canWrite={Boolean(canWrite)} />
          ) : (
            <CarriersPanel canWrite={Boolean(canWrite)} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
