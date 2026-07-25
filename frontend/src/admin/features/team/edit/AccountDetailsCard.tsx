import { useId } from 'react';

import type { TeamMemberEditErrors } from '../../../types/team-member-edit';
import { TeamToggleSwitch } from './TeamToggleSwitch';

/*
 * "Account details" — the member's name and email, a hairline, then the member
 * status switch.
 *
 * The two fields sit side by side from `md` up and stack on mobile, which is the
 * only layout difference across the three links.
 *
 * The design shows filled inputs with no validation state. Both fields are
 * required for an account to be usable, so an inline error is added under each —
 * shown only after a save attempt, so the form does not flag empty fields the
 * moment it opens. Logged as a deviation.
 */

type AccountDetailsCardProps = {
  name: string;
  email: string;
  isActive: boolean;
  statusDescription: string;
  errors: TeamMemberEditErrors;
  onNameChange: (next: string) => void;
  onEmailChange: (next: string) => void;
  onActiveChange: (next: boolean) => void;
};

export function AccountDetailsCard({
  name,
  email,
  isActive,
  statusDescription,
  errors,
  onNameChange,
  onEmailChange,
  onActiveChange,
}: AccountDetailsCardProps) {
  const nameId = useId();
  const emailId = useId();

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

      <hr className="w-full border-t border-gray-200" />

      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-form-label text-gray-800">Member status</p>
          <p className="text-small leading-[1.3] text-text-secondary md:text-[13px]">
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
