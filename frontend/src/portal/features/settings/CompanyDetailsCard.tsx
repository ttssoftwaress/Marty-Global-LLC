import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { SaveButton } from './ProfileInfoCard';
import type { CompanyDetails } from '../../types/settings';

/*
 * Company-details frame — the four company fields and (md+) the inline footer.
 * One tree serves tablet and desktop; the outer card chrome is dropped on mobile
 * (the mobile frame is a bare column on the page background with its own action
 * bar), so the page passes `bare` there.
 *
 * Country/region is a native <select> so it stays accessible and keyboard-driven;
 * the option list is the set of selectable choices, not customer data — the
 * chosen value comes from the page's state, seeded from the company record once
 * its endpoint lands (two-apps sync rule).
 */

// Selectable choices for the Country / region field. These are options a user
// picks from, not seeded customer data — the current value lives in page state.
const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'US', label: 'USA' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SG', label: 'Singapore' },
];

type CompanyDetailsCardProps = {
  value: CompanyDetails;
  onChange: (field: keyof CompanyDetails, next: string) => void;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  isSaving?: boolean;
  /* Mobile drills into a bare frame (no card chrome, no inline footer — the page
   * supplies its own action bar); tablet/desktop render the full card. */
  bare?: boolean;
};

export function CompanyDetailsCard({
  value,
  onChange,
  onCancel,
  onSave,
  canSave,
  isSaving = false,
  bare = false,
}: CompanyDetailsCardProps) {
  const shell = bare
    ? 'flex w-full flex-col gap-5'
    : 'flex w-full flex-1 flex-col gap-6 rounded-card border border-gray-200 bg-white p-6 md:p-8';

  return (
    <div className={shell}>
      {/* The frame title is the mobile page heading; keep it here for md+ and for
          the mobile card, matching the design where the card carries its own
          "Company details" title. */}
      <h2 className="text-h6 font-semibold text-text">Company details</h2>

      {/* Fields */}
      <div className="flex w-full flex-col gap-4 md:gap-5">
        {/* Business name */}
        <div className="flex w-full flex-col gap-1.5">
          <FieldLabel htmlFor="company-businessName">Business name</FieldLabel>
          <input
            id="company-businessName"
            type="text"
            autoComplete="organization"
            value={value.businessName}
            onChange={(event) => onChange('businessName', event.target.value)}
            className="input-field"
          />
        </div>

        {/* Country / region — native select with a trailing chevron */}
        <div className="flex w-full flex-col gap-1.5">
          <FieldLabel htmlFor="company-country">Country / region</FieldLabel>
          <div className="relative w-full">
            <select
              id="company-country"
              autoComplete="country"
              value={value.country}
              onChange={(event) => onChange('country', event.target.value)}
              className="input-field w-full cursor-pointer appearance-none truncate pr-11"
            >
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-gray-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Industry / business activity */}
        <div className="flex w-full flex-col gap-1.5">
          <FieldLabel htmlFor="company-industry">
            Industry / business activity
          </FieldLabel>
          <input
            id="company-industry"
            type="text"
            autoComplete="off"
            value={value.industry}
            onChange={(event) => onChange('industry', event.target.value)}
            className="input-field"
          />
        </div>

        {/* Forwarding address — multi-line. This is the destination the mail
            room ships forwarded post to, so the label names that use rather
            than the record it happens to live on. */}
        <div className="flex w-full flex-col gap-1.5">
          <FieldLabel htmlFor="forwarding-address">
            Forwarding address
          </FieldLabel>
          <textarea
            id="forwarding-address"
            autoComplete="street-address"
            rows={3}
            value={value.address}
            onChange={(event) => onChange('address', event.target.value)}
            className="input-field h-24 resize-none py-3 leading-[1.4]"
          />
          <p className="text-caption text-gray-400">
            Where we ship mail you ask us to forward. These details also help us
            tailor services to your region's requirements.
          </p>
        </div>
      </div>

      {/* Inline footer — tablet & desktop only. */}
      {!bare && (
        <div className="flex w-full items-center justify-end gap-4 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center px-4 text-[0.875rem] font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Cancel
          </button>
          <SaveButton onClick={onSave} disabled={!canSave} isSaving={isSaving} />
        </div>
      )}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[0.875rem] font-medium text-gray-700">
      {children}
    </label>
  );
}
