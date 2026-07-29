import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { authClient } from '@/auth/client';
import { useCompactScale } from '@/hooks/useCompactScale';
import { LeftPanel, SecureTrust } from './components/auth-brand';
import { ArrowLeftIcon } from './components/icons';

const LOGIN_ROUTE = '/login';
const CHECK_EMAIL_ROUTE = '/check-your-email';
// Better Auth emails a backend callback link that validates the token, then
// redirects here with the token appended — SetNewPasswordPage reads it.
const RESET_REDIRECT_PATH = '/reset-password/new';

/*
 * Password reset — step 1 ("Request a reset link"). The user enters their email
 * and we dispatch a reset link. Choosing the new password happens on
 * SetNewPasswordPage after the emailed link is followed. One request form
 * renders across all breakpoints; only the surrounding chrome changes.
 */
export function ResetPasswordPage() {
  useCompactScale();

  return (
    <div className="flex min-h-screen w-full flex-col items-stretch bg-white lg:flex-row">
      <LeftPanel
        title="Pick Up Right Where You Left Off"
        subtitle="Need to access your ongoing international filings? Securely reset your password credentials here."
      />
      <RightPanel />
    </div>
  );
}

/*
 * Mobile brand header — bottom-bordered color logo strip. Hidden from tablet up
 * (md+), where the logo sits centered above the vertically-centered form.
 */
function MobileHeader() {
  return (
    <div className="flex w-full flex-col items-center justify-center border-b border-gray-100 px-6 py-9 md:hidden">
      <img
        src={logoColor}
        alt="Marty Global LLC"
        className="h-[3.75rem] w-[11.25rem] object-contain"
      />
    </div>
  );
}

function RightPanel() {
  return (
    <div className="flex flex-1 flex-col bg-white lg:items-center lg:justify-center lg:px-24 lg:py-24 xl:w-[49.5rem] xl:flex-none xl:shrink-0">
      <MobileHeader />

      {/*
       * md+ (tablet & desktop) centers the logo above the form; mobile hides it
       * here since the bordered MobileHeader already carries the brand.
       */}
      <div className="flex w-full flex-1 flex-col items-center justify-between px-6 py-10 md:px-16 md:pb-12 md:pt-16 lg:p-0">
        <div className="flex w-full flex-1 flex-col items-center justify-center md:flex-none md:justify-start">
          <img
            src={logoColor}
            alt="Marty Global LLC"
            className="mb-[3.25rem] hidden h-20 w-[12.5rem] object-contain md:block lg:hidden"
          />

          <div className="flex w-full max-w-[30rem] flex-col gap-7 md:gap-8 lg:w-[30rem] lg:max-w-none">
            <RequestResetForm />
          </div>
        </div>

        <SecureTrust
          className="mt-10 md:mt-0 lg:hidden"
          textClassName="text-[0.8125rem] leading-none text-text-secondary md:text-small"
        />
      </div>

      <SecureTrust
        className="hidden lg:flex"
        textClassName="text-[0.8125rem] leading-none text-text-secondary md:text-small"
      />
    </div>
  );
}

/*
 * Email entry that dispatches a reset link — rendered at every breakpoint.
 * Header is left-aligned on desktop and centered below (mobile & tablet).
 */
function RequestResetForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email address is required');
      return;
    }

    setSubmitting(true);
    // Better Auth always replies success-shaped (even for an unknown email) to
    // avoid leaking which addresses exist, so any error here is a transport or
    // server fault, not "no such account".
    const { error: resetError } = await authClient.requestPasswordReset({
      email: trimmed,
      redirectTo: `${window.location.origin}${RESET_REDIRECT_PATH}`,
    });

    if (resetError) {
      setSubmitting(false);
      setError(
        resetError.message ??
          'We could not send the reset link. Please try again.',
      );
      return;
    }

    // Carry the address forward so the confirmation screen can name it.
    navigate(CHECK_EMAIL_ROUTE, { state: { email: trimmed } });
  }

  return (
    <form className="flex w-full flex-col gap-8" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 text-center lg:text-left">
        <h2 className="text-[1.75rem] font-semibold leading-none text-text">
          Reset Your Password
        </h2>
        <p className="text-body leading-[1.375rem] text-text-secondary">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="reset-email" className="text-form-label text-text">
          Email Address
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          placeholder="enter your email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          className="input-field"
        />
        {error && (
          <p role="alert" className="text-[0.8125rem] leading-[1.3] text-error">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary h-12 w-full rounded-input text-button disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send Reset Link'}
      </button>

      <BackToLogIn />
    </form>
  );
}

function BackToLogIn() {
  return (
    <Link
      to={LOGIN_ROUTE}
      className="flex items-center justify-center gap-1.5 text-form-label font-semibold text-primary"
    >
      <ArrowLeftIcon className="size-4" />
      Back to Log In
    </Link>
  );
}
