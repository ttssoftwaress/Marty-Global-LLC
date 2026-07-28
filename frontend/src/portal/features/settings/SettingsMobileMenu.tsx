import { ChevronRight } from 'lucide-react';

import { SETTINGS_SECTIONS } from './settings-sections';
import type { SettingsSection } from '../../types/settings';

/*
 * Mobile-only settings menu (the first mobile frame): a single card whose rows
 * are the four sections — an icon chip, the label, and a chevron. Tapping a row
 * opens that section's frame (drilling in, master → detail). Rows carry a hair
 * divider except the last.
 *
 * Rendered only below md; tablet/desktop show the inline SettingsTabs instead.
 */

type SettingsMobileMenuProps = {
  onSelect: (section: SettingsSection) => void;
};

export function SettingsMobileMenu({ onSelect }: SettingsMobileMenuProps) {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:hidden">
      <ul>
        {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }, index) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={`flex h-14 w-full items-center justify-between gap-3 text-left ${
                index < SETTINGS_SECTIONS.length - 1 ? 'border-b border-gray-200' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-primary-light">
                  <Icon className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-[0.875rem] font-medium text-text">{label}</span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-gray-400"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
