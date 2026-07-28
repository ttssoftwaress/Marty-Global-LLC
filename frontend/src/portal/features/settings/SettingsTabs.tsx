import { SETTINGS_SECTIONS } from './settings-sections';
import type { SettingsSection } from '../../types/settings';

/*
 * Section switcher for tablet and desktop. Both read the same SETTINGS_SECTIONS
 * list; only the shape differs, so one component renders both and Tailwind swaps
 * the layout at the breakpoint:
 *
 *   - Desktop (lg+): a 280px vertical rail card, the active row on a light-brand
 *     fill (the two-column layout puts it beside the panel).
 *   - Tablet (md): a single horizontal card of pill tabs, the active pill on the
 *     brand navy fill, scrollable if the four ever overflow.
 *
 * Hidden below md — mobile uses the full-page menu list instead.
 */

type SettingsTabsProps = {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
};

export function SettingsTabs({ active, onSelect }: SettingsTabsProps) {
  return (
    <nav aria-label="Account settings sections">
      {/* Desktop — vertical rail */}
      <ul className="hidden w-[17.5rem] shrink-0 flex-col gap-1 rounded-card border border-gray-200 bg-white p-4 lg:flex">
        {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-12 w-full items-center gap-3 rounded-input px-4 text-left text-[0.875rem] font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-light text-primary [&>svg]:text-accent'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Tablet — horizontal pill row */}
      <ul className="hidden gap-1.5 overflow-x-auto rounded-card border border-gray-200 bg-white p-1.5 md:flex lg:hidden">
        {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-10 items-center gap-1.5 rounded-pill px-2.5 text-[0.75rem] transition-colors ${
                  isActive
                    ? 'bg-primary font-medium text-white'
                    : 'font-normal text-text-secondary hover:bg-gray-100'
                }`}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
