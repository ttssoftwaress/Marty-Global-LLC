import { Link } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import logoColor from '@/assets/Marty-Logo-Color.PNG';
import {
  ArrowLeftIcon,
  ShieldAlertIcon,
  StarIcon,
} from './components/icons';

const LOGIN_ROUTE = '/login';

/*
 * Password reset — step 1 ("Request a reset link"). The user enters their email
 * and we dispatch a reset link. Choosing the new password happens on
 * SetNewPasswordPage after the emailed link is followed. One request form
 * renders across all breakpoints; only the surrounding chrome changes.
 */
export function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-stretch bg-white lg:flex-row">
      <LeftPanel />
      <RightPanel />
    </div>
  );
}

function LeftPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-16 lg:flex lg:w-1/2 lg:shrink-0 xl:w-[648px]">
      <DotPattern />

      <div className="relative flex flex-col gap-20">
        <img
          src={logoWhite}
          alt="Marty Global LLC"
          className="h-[50px] w-[182px] object-contain object-left"
        />
        <div className="flex flex-col gap-4 text-white">
          <h1 className="text-marketing-h2">Pick Up Right Where You Left Off</h1>
          <p className="text-body-lg leading-[26px] opacity-80">
            Need to access your ongoing international filings? Securely reset
            your password credentials here.
          </p>
        </div>
      </div>

      <TrustCard />
    </div>
  );
}

function DotPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-[150px] flex h-[600px] w-[648px] flex-col justify-between opacity-[0.12]"
    >
      {Array.from({ length: 13 }).map((_, row) => (
        <div key={row} className="flex justify-between">
          {Array.from({ length: 16 }).map((_, col) => (
            <span key={col} className="size-[2px] rounded-[1px] bg-white" />
          ))}
        </div>
      ))}
    </div>
  );
}

function TrustCard() {
  return (
    <div className="relative flex flex-col gap-4 rounded-card border border-white/15 bg-white/[0.08] p-6">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} className="size-4 text-warning" />
        ))}
      </div>

      <p className="text-body italic leading-[22px] text-white">
        &quot;Setting up our US entity through Marty Global was incredibly seamless.
        Their dashboard makes compliance and international trade simple.&quot;
      </p>

      <div className="h-px w-full bg-white/15" />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5 text-white">
          <p className="text-body font-semibold">10,000+ Businesses</p>
          <p className="text-small opacity-60">Managed globally across USA, UK &amp; EU</p>
        </div>
        <span className="rounded-pill bg-success px-2.5 py-1 text-caption font-semibold text-white">
          SECURE
        </span>
      </div>
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
        className="h-[60px] w-[180px] object-contain"
      />
    </div>
  );
}

function RightPanel() {
  return (
    <div className="flex flex-1 flex-col bg-white lg:items-center lg:justify-center lg:px-24 lg:py-24 xl:w-[792px] xl:flex-none xl:shrink-0">
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
            className="mb-[52px] hidden h-20 w-[200px] object-contain md:block lg:hidden"
          />

          <div className="flex w-full max-w-[480px] flex-col gap-7 md:gap-8 lg:w-[480px] lg:max-w-none">
            <RequestResetForm />
          </div>
        </div>

        <SecureTrust className="mt-10 md:mt-0 lg:hidden" />
      </div>

      <SecureTrust className="hidden lg:flex" />
    </div>
  );
}

/*
 * Email entry that dispatches a reset link — rendered at every breakpoint.
 * Header is left-aligned on desktop and centered below (mobile & tablet).
 */
function RequestResetForm() {
  return (
    <form
      className="flex w-full flex-col gap-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2 text-center lg:text-left">
        <h2 className="text-[28px] font-semibold leading-none text-text">
          Reset Your Password
        </h2>
        <p className="text-body leading-[22px] text-text-secondary">
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
          placeholder="enter your email address"
          className="input-field"
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary h-12 w-full rounded-input text-button"
      >
        Send Reset Link
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

type SecureTrustProps = { className?: string };

function SecureTrust({ className }: SecureTrustProps) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className ?? ''}`}>
      <ShieldAlertIcon className="size-4 shrink-0 text-text-secondary" />
      <p className="text-[13px] leading-none text-text-secondary md:text-small">
        Your information is encrypted and secure.
      </p>
    </div>
  );
}
