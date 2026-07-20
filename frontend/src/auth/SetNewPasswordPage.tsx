import { useState } from 'react';
import { Link } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { LeftPanel, SecureTrust } from './components/auth-brand';
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
} from './components/icons';

const LOGIN_ROUTE = '/login';

/*
 * Password reset — step 3 ("Set a New Password"). The user has followed the
 * emailed link and now chooses a new password (key badge, new + confirm
 * fields). One centered form is shared across breakpoints; only the surrounding
 * chrome changes: desktop shows the navy brand panel, tablet a logo + title
 * header strip, mobile just the logo.
 */
export function SetNewPasswordPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-stretch bg-white lg:flex-row">
      <LeftPanel
        className="min-h-screen"
        title="Setting Global Corporate Standards"
        subtitle="Unlock corporate potential from anywhere. Marty Global manages your business structure so you can focus on expansion."
      />
      <RightPanel />
    </div>
  );
}

/*
 * Tablet header — logo above the navy "Reset Your Password" title in a
 * bottom-bordered strip. Mobile shows the logo only (no title); the navy left
 * panel replaces this header from lg up.
 */
function BrandHeader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border-b border-gray-100 px-6 py-9 md:gap-4 md:px-10 md:pb-6 md:pt-8 lg:hidden">
      <img
        src={logoColor}
        alt="Marty Global LLC"
        className="h-16 w-40 object-contain md:h-[60px] md:w-[180px]"
      />
      <h1 className="hidden text-[28px] font-bold leading-none text-primary md:block">
        Reset Your Password
      </h1>
    </div>
  );
}

function RightPanel() {
  return (
    <div className="flex flex-1 flex-col bg-white lg:min-h-screen lg:items-center lg:justify-between lg:px-24 lg:py-24 xl:w-[792px] xl:flex-none xl:shrink-0">
      <BrandHeader />

      <div className="flex w-full flex-1 flex-col items-center justify-center gap-7 px-6 py-10 md:gap-12 md:px-12 md:py-16 lg:p-0">
        <SetPasswordForm />
        {/* Mobile & tablet: trust note sits after the form. Desktop: pinned below. */}
        <SecureTrust className="lg:hidden" />
      </div>

      <SecureTrust className="hidden lg:flex" />
    </div>
  );
}

function SetPasswordForm() {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form
      className="flex w-full max-w-[480px] flex-col items-center gap-6 md:gap-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-light md:size-16">
        <KeyIcon className="size-6 text-primary md:size-8" />
      </div>

      <div className="flex w-full flex-col items-center gap-2 text-center md:gap-3">
        <h2 className="text-2xl font-semibold leading-none text-text md:text-[28px]">
          Reset Your Password
        </h2>
        <p className="text-body leading-[1.4] text-text-secondary md:leading-[22px]">
          Enter your new password below to secure your account.
        </p>
      </div>

      <div className="flex w-full flex-col gap-4 md:gap-5">
        <PasswordField
          id="new-password"
          label="New Password"
          visible={showNew}
          onToggle={() => setShowNew((v) => !v)}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm New Password"
          visible={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary h-12 w-full rounded-lg text-[15px] md:h-11"
      >
        Reset Password
      </button>

      <div className="h-px w-full bg-gray-200" />

      <Link
        to={LOGIN_ROUTE}
        className="flex items-center justify-center gap-1.5 text-form-label font-semibold text-primary"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Log In
      </Link>
    </form>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  visible: boolean;
  onToggle: () => void;
};

function PasswordField({ id, label, visible, onToggle }: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 md:gap-2">
      <label htmlFor={id} className="text-[13px] font-medium leading-none text-gray-700 md:text-form-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder="••••••••••••"
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 pr-11 text-[15px] text-text outline-none placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--color-primary)] md:text-base"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-gray-500"
        >
          {visible ? <EyeIcon className="size-full" /> : <EyeOffIcon className="size-full" />}
        </button>
      </div>
    </div>
  );
}
