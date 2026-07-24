import type { ProfileInfo } from '../../types/settings';

/*
 * Profile-info frame — the avatar row, the three text fields, and (md+) the
 * inline footer. One tree serves tablet and desktop; the outer card chrome is
 * dropped on mobile (the mobile frame is a bare column on the page background
 * with its own sticky save bar), so the page passes `bare` there.
 *
 * Values are controlled by the page. Nothing here is hardcoded customer data —
 * name/email seed from the session and phone from the profile record once its
 * endpoint lands; the fields render whatever the page holds in state.
 */

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

type ProfileField = {
  id: keyof Pick<ProfileInfo, 'fullName' | 'email' | 'phone'>;
  label: string;
  type: string;
  autoComplete: string;
};

const FIELDS: ProfileField[] = [
  { id: 'fullName', label: 'Full name', type: 'text', autoComplete: 'name' },
  { id: 'email', label: 'Email address', type: 'email', autoComplete: 'email' },
  { id: 'phone', label: 'Phone number', type: 'tel', autoComplete: 'tel' },
];

type ProfileInfoCardProps = {
  value: ProfileInfo;
  onChange: (field: ProfileField['id'], next: string) => void;
  onChangePhoto: () => void;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  isSaving?: boolean;
  /* Mobile drills into a bare frame (no card chrome, no inline footer — the page
   * supplies a sticky save bar); tablet/desktop render the full card. */
  bare?: boolean;
};

export function ProfileInfoCard({
  value,
  onChange,
  onChangePhoto,
  onCancel,
  onSave,
  canSave,
  isSaving = false,
  bare = false,
}: ProfileInfoCardProps) {
  const shell = bare
    ? 'flex w-full flex-col gap-6'
    : 'flex w-full flex-1 flex-col gap-6 rounded-card border border-gray-200 bg-white p-6 md:p-8';

  return (
    <div className={shell}>
      {/* The frame title is the mobile page heading, so it's only shown md+ here
          to avoid doubling up. */}
      {!bare && (
        <h2 className="text-h6 font-semibold text-text">Profile info</h2>
      )}

      {/* Avatar — mobile stacks it centered, tablet/desktop sit it beside the
          button. */}
      <div
        className={`flex w-full gap-3 md:flex-row md:items-center md:gap-4 ${
          bare ? 'flex-col items-center' : 'items-center'
        }`}
      >
        <div
          className={`flex size-16 shrink-0 items-center justify-center rounded-full text-h5 font-semibold ${
            bare
              ? 'bg-primary text-white'
              : 'bg-gray-200 text-gray-600 md:bg-primary-light md:text-primary'
          }`}
          aria-hidden="true"
        >
          {initials(value.fullName)}
        </div>
        <button
          type="button"
          onClick={onChangePhoto}
          className="inline-flex h-10 items-center justify-center rounded-input border border-primary bg-white px-4 text-[14px] font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Change photo
        </button>
      </div>

      {/* Fields */}
      <div className="flex w-full flex-col gap-4 md:gap-5">
        {FIELDS.map((field) => (
          <div key={field.id} className="flex w-full flex-col gap-1.5">
            <label
              htmlFor={`profile-${field.id}`}
              className="text-[14px] font-medium text-gray-700"
            >
              {field.label}
            </label>
            <input
              id={`profile-${field.id}`}
              type={field.type}
              autoComplete={field.autoComplete}
              value={value[field.id]}
              onChange={(event) => onChange(field.id, event.target.value)}
              className="input-field"
            />
          </div>
        ))}
      </div>

      {/* Inline footer — tablet & desktop only. */}
      {!bare && (
        <div className="flex w-full items-center justify-end gap-4 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center px-4 text-[14px] font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Cancel
          </button>
          <SaveButton onClick={onSave} disabled={!canSave} isSaving={isSaving} />
        </div>
      )}
    </div>
  );
}

/*
 * The Save button — shared by the inline (md+) footer and the mobile sticky bar
 * so the disabled/saving styling stays identical. Disabled matches the design's
 * grey fill; enabled is the brand primary.
 */
export function SaveButton({
  onClick,
  disabled,
  isSaving,
  className = '',
  label = 'Save changes',
  savingLabel = 'Saving…',
}: {
  onClick: () => void;
  disabled: boolean;
  isSaving: boolean;
  className?: string;
  label?: string;
  savingLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSaving}
      className={`inline-flex h-12 items-center justify-center rounded-input px-5 text-[14px] font-semibold transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-gray-200 text-gray-400'
          : 'bg-primary text-white hover:bg-primary-hover'
      } ${className}`}
    >
      {isSaving ? savingLabel : label}
    </button>
  );
}
