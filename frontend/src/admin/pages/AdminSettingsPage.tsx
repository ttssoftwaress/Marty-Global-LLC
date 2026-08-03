import { useState } from 'react';
import { Info } from 'lucide-react';

import { Role } from '@/constants/roles';
import { AdminLayout } from '../components/AdminLayout';
import {
  BankAccountsPanel,
  PaymentConfigPanel,
} from '../features/payment-settings';
import { CarriersPanel } from '../features/settings/CarriersPanel';
import { EmailDeliveryPanel } from '../features/settings/EmailDeliveryPanel';
import { LocationsPanel } from '../features/settings/LocationsPanel';
import { useAdminShell } from '../hooks/useAdminShell';
import { useAdminMe } from '../queries/admin-me';

/*
 * Admin settings — the configuration the rest of the system reads.
 *
 * This screen exists because none of it used to be data. Locations and mail
 * carriers were rows a seed script inserted, which made "which countries do we
 * operate in" a code change; the deposit address, the USD→USDT rate, and the
 * confirmation depth were environment variables, which made rotating a wallet a
 * redeploy. Nothing seeds any of it now: these four panels are where it comes
 * from, and where it is retired.
 *
 * Tabs rather than routes, for the same reason the field registry pairs its two
 * halves: an admin moves between them while setting the business up, and
 * separate URLs would turn that into navigation.
 *
 * Two different permissions live on one screen, which is deliberate rather than
 * sloppy. Locations and carriers are the `settings` area; the payment tabs are
 * the `payments` area, because that is where the money goes — someone who
 * curates jurisdictions should not thereby be able to change the receiving
 * address. Each pair of tabs is hidden from a member who does not hold its area,
 * and the backend enforces the same split (the real boundary, AGENTS.md).
 *
 * Writing is admin-only on both routers, so a staff member holding an area sees
 * the lists without the controls that would 403 on them. `canWrite` is
 * convenience.
 *
 * No Figma link — built to the written brief in the same card, table, and tab
 * language as the designed admin screens, and logged as a deviation.
 */

type SettingsTab =
  | 'locations'
  | 'carriers'
  | 'email'
  | 'payments'
  | 'bank-accounts';

type TabDefinition = {
  value: SettingsTab;
  label: string;
  /** The permission area this tab's endpoints sit behind. */
  area: 'settings' | 'payments';
};

const TABS: TabDefinition[] = [
  { value: 'locations', label: 'Locations', area: 'settings' },
  { value: 'carriers', label: 'Mail carriers', area: 'settings' },
  /*
   * The outbound-email switch. In the `settings` area rather than a new one: it
   * is one operational switch, and it is the counterpart of the
   * automatic-verification switch two tabs along — the two background
   * integrations that ever need standing down in a hurry.
   */
  { value: 'email', label: 'Email', area: 'settings' },
  { value: 'payments', label: 'Payments', area: 'payments' },
  { value: 'bank-accounts', label: 'Bank accounts', area: 'payments' },
];

export function AdminSettingsPage() {
  const { user, onLogout } = useAdminShell();
  const me = useAdminMe();
  const [tab, setTab] = useState<SettingsTab>('locations');

  const canWrite = me.data?.role === Role.ADMIN;

  /*
   * Which tabs this member may open. Hiding one the server would refuse is a
   * courtesy, not a boundary — `requirePermission` on each router is the real
   * check, and both read the same grant list, so they cannot disagree.
   *
   * Until `me` resolves nothing is filtered out: a flash of the full tab strip
   * is better than a flash of an empty one, and the panels behind it do not
   * fetch until they render.
   */
  const permissions = me.data?.permissions;
  const visibleTabs = permissions
    ? TABS.filter((option) => permissions.includes(option.area))
    : TABS;

  // A member who holds only `payments` lands on Locations otherwise — a tab that
  // is not in their strip and whose panel would 403.
  const activeTab = visibleTabs.some((option) => option.value === tab)
    ? tab
    : (visibleTabs[0]?.value ?? tab);

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
                The lists every other section picks from, and how you get paid.
                Change something here and it changes everywhere it is used — no
                deploy, no database script.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Settings"
              className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-input bg-gray-100 p-1"
            >
              {visibleTabs.map((option) => {
                const active = option.value === activeTab;
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
              You can view these settings but not change them — editing them is
              restricted to admins.
            </p>
          )}

          {activeTab === 'locations' && <LocationsPanel canWrite={Boolean(canWrite)} />}
          {activeTab === 'carriers' && <CarriersPanel canWrite={Boolean(canWrite)} />}
          {activeTab === 'email' && <EmailDeliveryPanel canWrite={Boolean(canWrite)} />}
          {activeTab === 'payments' && <PaymentConfigPanel canWrite={Boolean(canWrite)} />}
          {activeTab === 'bank-accounts' && (
            <BankAccountsPanel canWrite={Boolean(canWrite)} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
