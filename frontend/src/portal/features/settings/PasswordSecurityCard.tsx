import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { SaveButton } from './ProfileInfoCard';
import { PASSWORD_REQUIREMENTS, passwordStrength } from './password-strength';
import type { PasswordChange } from '../../types/settings';

/*
 * Password & security frame — the three password fields, a live strength meter
 * and requirement checklist under the new password, and (md+) the inline footer.
 * One tree serves tablet and desktop; the card chrome is dropped on mobile (the
 * page drills into a bare column with its own action bar), so the page passes
 * `bare` there.
 *
 * This is a change-password form: all three fields start empty and are controlled
 * by the page. The strength bar, checklist, and mismatch error derive from what
 * the customer types — nothing is hardcoded. Save button is labelled "Update
 * password" and unlocks only once the form is genuinely valid.
 */

type PasswordField = {
  id: keyof PasswordChange;
  label: string;
  autoComplete: string;
};

const FIELDS: PasswordField[] = [
  {
    id: 'currentPassword',
    label: 'Current password',
    autoComplete: 'current-password',
  },
  { id: 'newPassword', label: 'New password', autoComplete: 'new-password' },
  {
    id: 'confirmPassword',
    label: 'Confirm new password',
    autoComplete: 'new-password',
  },
];

// The strength bar's four segments take a single tier colour: filled segments up
// to the score, tinted by how strong the password is. Empty segments stay grey.
function segmentColor(index: number, score: number): string {
  if (index >= score) return 'bg-gray-200';
  if (score <= 1) return 'bg-error';
  if (score <= 3) return 'bg-warning';
  return 'bg-success';
}

type PasswordSecurityCardProps = {
  value: PasswordChange;
  onChange: (field: keyof PasswordChange, next: string) => void;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  isSaving?: boolean;
  /* Mobile drills into a bare frame (no card chrome, no inline footer — the page
   * supplies its own action bar); tablet/desktop render the full card. */
  bare?: boolean;
};

export function PasswordSecurityCard({
  value,
  onChange,
  onCancel,
  onSave,
  canSave,
  isSaving = false,
  bare = false,
}: PasswordSecurityCardProps) {
  // Per-field reveal toggles — the eye icon in the design.
  const [revealed, setRevealed] = useState<Record<keyof PasswordChange, boolean>>(
    {
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    },
  );

  const toggleReveal = (field: keyof PasswordChange) =>
    setRevealed((prev) => ({ ...prev, [field]: !prev[field] }));

  const strength = passwordStrength(value.newPassword);

  // The mismatch error only shows once the customer has started confirming and
  // the two entries actually differ — not while the confirm field is still empty.
  const mismatch =
    value.confirmPassword.length > 0 &&
    value.newPassword !== value.confirmPassword;

  const shell = bare
    ? 'flex w-full flex-col gap-5'
    : 'flex w-full flex-1 flex-col gap-6 rounded-card border border-gray-200 bg-white p-6 md:p-8';

  return (
    <div className={shell}>
      <h2 className="text-h6 font-semibold text-text">Password &amp; security</h2>

      <div className="flex w-full flex-col gap-4 md:gap-5">
        {FIELDS.map((field) => {
          const isNew = field.id === 'newPassword';
          const isConfirm = field.id === 'confirmPassword';
          const hasError = isConfirm && mismatch;

          return (
            <div key={field.id} className="flex w-full flex-col gap-1.5">
              <label
                htmlFor={`security-${field.id}`}
                className="text-[0.875rem] font-medium text-gray-700"
              >
                {field.label}
              </label>

              <div className="relative w-full">
                <input
                  id={`security-${field.id}`}
                  type={revealed[field.id] ? 'text' : 'password'}
                  autoComplete={field.autoComplete}
                  value={value[field.id]}
                  onChange={(event) => onChange(field.id, event.target.value)}
                  aria-invalid={hasError || undefined}
                  className={`input-field pr-11 ${
                    hasError
                      ? 'border-error focus:border-error focus:shadow-[0_0_0_1px_var(--color-error)]'
                      : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => toggleReveal(field.id)}
                  aria-label={
                    revealed[field.id]
                      ? `Hide ${field.label.toLowerCase()}`
                      : `Show ${field.label.toLowerCase()}`
                  }
                  aria-pressed={revealed[field.id]}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                >
                  {revealed[field.id] ? (
                    <EyeOff className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Eye className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* New-password affordances: strength meter + requirement checklist,
                  shown once the customer starts typing a new password. */}
              {isNew && value.newPassword.length > 0 && (
                <div className="mt-1.5 flex w-full flex-col gap-3">
                  <div className="flex w-full items-start gap-1" role="presentation">
                    {[0, 1, 2, 3].map((segment) => (
                      <div
                        key={segment}
                        className={`h-2 min-w-0 flex-1 rounded-pill ${segmentColor(
                          segment,
                          strength,
                        )}`}
                      />
                    ))}
                  </div>
                  <ul className="flex w-full flex-col gap-1.5">
                    {PASSWORD_REQUIREMENTS.map((rule) => {
                      const met = rule.met(value.newPassword);
                      return (
                        <li
                          key={rule.id}
                          className={`flex items-center gap-1.5 text-[0.75rem] ${
                            met ? 'text-success' : 'text-gray-400'
                          }`}
                        >
                          <span aria-hidden="true">{met ? '✓' : '○'}</span>
                          <span>{rule.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Confirm-field mismatch error. */}
              {hasError && (
                <p className="text-[0.75rem] text-error">Passwords don&apos;t match</p>
              )}
            </div>
          );
        })}
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
          <SaveButton
            onClick={onSave}
            disabled={!canSave}
            isSaving={isSaving}
            label="Update password"
            savingLabel="Updating…"
          />
        </div>
      )}
    </div>
  );
}
