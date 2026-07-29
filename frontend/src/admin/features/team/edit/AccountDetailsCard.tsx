import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import type { TeamMemberEditErrors } from '../../../types/team-member-edit';
import { TeamToggleSwitch } from './TeamToggleSwitch';

/*
 * "Account details" — the member's name and email, the password reset, a
 * hairline, then the member status switch.
 *
 * The name and email fields sit side by side from `md` up and stack on mobile,
 * which is the only layout difference across the three links.
 *
 * The design shows filled inputs with no validation state. Both fields are
 * required for an account to be usable, so an inline error is added under each —
 * shown only after a save attempt, so the form does not flag empty fields the
 * moment it opens. Logged as a deviation.
 *
 * The password field is also a deviation: the design has none, but an admin who
 * creates the login is the one a member asks when they are locked out, so there
 * has to be a way to set a new one. It is left blank on load and blank means
 * "leave it alone" — a password is write-only, so there is nothing to seed it
 * with and nothing to show.
 */

type AccountDetailsCardProps = {
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  statusDescription: string;
  errors: TeamMemberEditErrors;
  onNameChange: (next: string) => void;
  onEmailChange: (next: string) => void;
  onPasswordChange: (next: string) => void;
  onActiveChange: (next: boolean) => void;
};

export function AccountDetailsCard({
  name,
  email,
  password,
  isActive,
  statusDescription,
  errors,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onActiveChange,
}: AccountDetailsCardProps) {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="flex w-full flex-col gap-5 rounded-card border border-gray-200 bg-white p-5 shadow-sm-elevation md:gap-card md:p-card">
      <h2 className="text-h6 text-text">Account details</h2>

      <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:gap-5">
        <div className="flex w-full min-w-0 flex-col gap-2 md:flex-1">
          <label htmlFor={nameId} className="text-form-label text-gray-800">
            Full name
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
            className={`input-field ${errors.name ? 'border-error' : ''}`}
          />
          {errors.name ? (
            <p id={`${nameId}-error`} className="text-small text-error">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 md:flex-1">
          <label htmlFor={emailId} className="text-form-label text-gray-800">
            Email address
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            className={`input-field ${errors.email ? 'border-error' : ''}`}
          />
          {errors.email ? (
            <p id={`${emailId}-error`} className="text-small text-error">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={passwordId} className="text-form-label text-gray-800">
          New password
        </label>

        <div className="relative w-full">
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            value={password}
            placeholder="Leave blank to keep the current password"
            // An admin setting someone else's password — the browser must not
            // offer to fill or save it against the admin's own login.
            autoComplete="new-password"
            onChange={(event) => onPasswordChange(event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? `${passwordId}-error` : `${passwordId}-hint`
            }
            className={`input-field w-full pr-12 ${errors.password ? 'border-error' : ''}`}
          />

          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-gray-500 transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {showPassword ? (
              <EyeOff className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>

        {errors.password ? (
          <p id={`${passwordId}-error`} className="text-small text-error">
            {errors.password}
          </p>
        ) : (
          <p id={`${passwordId}-hint`} className="text-small text-gray-400">
            Setting a password here replaces the member’s current one and signs
            them in with it immediately.
          </p>
        )}
      </div>

      <hr className="w-full border-t border-gray-200" />

      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-form-label text-gray-800">Member status</p>
          <p className="text-small leading-[1.3] text-text-secondary md:text-[0.8125rem]">
            {statusDescription}
          </p>
        </div>

        <TeamToggleSwitch
          checked={isActive}
          onChange={onActiveChange}
          label="Member status"
        />
      </div>
    </section>
  );
}
