import { SaveButton } from './ProfileInfoCard';
import { ToggleSwitch } from './ToggleSwitch';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MASTER,
} from './notification-preferences';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
} from '../../types/settings';

/*
 * Notification preferences frame — a channel matrix: EMAIL / IN-APP / SMS column
 * headers, a master "Email notifications" row that gates email account-wide, and
 * one row per category with a switch in each channel column.
 *
 * One tree serves all three viewports; the toggle block just narrows at each
 * breakpoint (mobile 136px / tablet 220px / desktop 300px, matching the three
 * designs), and the row type steps down with it. The card chrome is dropped on
 * mobile when the page drills into a bare column, so the page passes `bare`.
 *
 * The master row draws a switch in the EMAIL column only — the design leaves its
 * IN-APP and SMS cells empty, so those render as spacers that keep the columns
 * aligned. Turning the master off disables (and visually mutes) every category's
 * email switch, since account-wide email is the gate above them; the stored
 * per-category values are left untouched so flipping it back restores them.
 *
 * Nothing here is hardcoded customer data — every switch is controlled by the
 * page, which seeds an all-off record until the preferences endpoint lands.
 */

type NotificationPreferencesCardProps = {
  value: NotificationPreferences;
  onToggleMaster: (next: boolean) => void;
  onToggleChannel: (
    category: NotificationCategory,
    channel: NotificationChannel,
    next: boolean,
  ) => void;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  isSaving?: boolean;
  /* Mobile drills into a bare frame (no card chrome, no inline footer — the page
   * supplies its own action bar); tablet/desktop render the full card. */
  bare?: boolean;
};

/* The toggle block's width, shared by the header labels and every row so the
 * columns line up. Steps 136 → 220 → 300 across the three designs. */
const TOGGLE_BLOCK =
  'flex shrink-0 items-center justify-end gap-2.5 w-[136px] md:w-[220px] md:gap-5 lg:w-[300px] lg:gap-10';

/* One column cell — fixed width so a missing switch still holds its place. */
const CELL = 'flex shrink-0 items-center justify-center w-[38px] md:w-[60px]';

export function NotificationPreferencesCard({
  value,
  onToggleMaster,
  onToggleChannel,
  onCancel,
  onSave,
  canSave,
  isSaving = false,
  bare = false,
}: NotificationPreferencesCardProps) {
  const shell = bare
    ? 'flex w-full flex-col gap-5'
    : 'flex w-full flex-1 flex-col gap-5 rounded-card border border-gray-200 bg-white p-4 md:gap-6 md:p-6 lg:p-8';

  return (
    <div className={shell}>
      <h2 className="text-[16px] font-semibold text-text lg:text-[18px]">
        Notification preferences
      </h2>

      <div className="flex w-full flex-col">
        {/* Column headers */}
        <div className="flex w-full items-end border-b border-gray-200 pb-2.5 md:pb-3">
          <div className="min-w-0 flex-1" />
          <div className={TOGGLE_BLOCK}>
            {NOTIFICATION_CHANNELS.map((channel) => (
              <p
                key={channel.id}
                className={`${CELL} text-center text-[9px] font-semibold uppercase tracking-[0.2px] text-text-secondary md:text-[11px] md:font-medium md:text-gray-500`}
              >
                {channel.label}
              </p>
            ))}
          </div>
        </div>

        {/* Master row — email delivery account-wide. Its EMAIL cell is the only
            switch; the other two columns stay empty per the design. */}
        <div className="flex w-full items-center border-b border-gray-200 py-3.5 md:py-4 lg:py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-3">
            <p className="text-[13px] font-semibold text-text md:text-[14px] md:font-medium">
              {NOTIFICATION_MASTER.label}
            </p>
            <p className="text-[11px] leading-[1.3] text-text-secondary md:text-[12px] md:leading-normal">
              {NOTIFICATION_MASTER.description}
            </p>
          </div>
          <div className={TOGGLE_BLOCK}>
            <div className={CELL}>
              <ToggleSwitch
                checked={value.emailMaster}
                onChange={onToggleMaster}
                label={`${NOTIFICATION_MASTER.label} — email`}
              />
            </div>
            <div className={CELL} aria-hidden="true" />
            <div className={CELL} aria-hidden="true" />
          </div>
        </div>

        {/* Category rows */}
        {NOTIFICATION_CATEGORIES.map((category, index) => (
          <div
            key={category.id}
            className={`flex w-full items-center py-3.5 md:py-4 ${
              index < NOTIFICATION_CATEGORIES.length - 1
                ? 'border-b border-gray-200'
                : ''
            }`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-3">
              <p className="text-[13px] font-semibold text-text md:text-[14px] md:font-normal">
                {category.label}
              </p>
              <p className="text-[11px] leading-[1.3] text-text-secondary md:text-[12px] md:leading-normal">
                {category.description}
              </p>
            </div>
            <div className={TOGGLE_BLOCK}>
              {NOTIFICATION_CHANNELS.map((channel) => {
                // Email delivery is gated by the master switch above.
                const gated = channel.id === 'email' && !value.emailMaster;
                return (
                  <div key={channel.id} className={CELL}>
                    <ToggleSwitch
                      checked={value.categories[category.id][channel.id]}
                      onChange={(next) =>
                        onToggleChannel(category.id, channel.id, next)
                      }
                      disabled={gated}
                      label={`${category.label} — ${channel.spokenLabel}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Inline footer — tablet & desktop only. */}
      {!bare && (
        <div className="flex w-full items-center justify-end gap-4 border-t border-gray-200 pt-4 md:pt-4 lg:pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center px-4 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-700 lg:text-[14px] lg:text-gray-500"
          >
            Cancel
          </button>
          <SaveButton
            onClick={onSave}
            disabled={!canSave}
            isSaving={isSaving}
            className="h-10 rounded-input px-4 text-[13px] lg:h-12 lg:px-5 lg:text-[14px]"
          />
        </div>
      )}
    </div>
  );
}
