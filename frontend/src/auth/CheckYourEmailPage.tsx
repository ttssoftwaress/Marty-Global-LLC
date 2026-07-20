import { Link } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { LeftPanel, SecureTrust } from './components/auth-brand';
import { ArrowLeftIcon, CheckIcon } from './components/icons';

const LOGIN_ROUTE = '/login';
const SENT_TO_EMAIL = 'hello@company.com';

/*
 * Password reset — step 2 ("Check Your Email"). Confirms the reset link was
 * dispatched. The Figma frames share one centered success card (green check
 * badge, heading, email confirmation, back-to-login link); only the surrounding
 * chrome changes by breakpoint: desktop shows the navy brand panel, tablet a
 * logo + title header strip, mobile just the logo.
 */
export function CheckYourEmailPage() {
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
 * Tablet header — logo above the navy "Check Your Email" title in a
 * bottom-bordered strip. Mobile shows the logo only (no title); the navy left
 * panel replaces this header from lg up.
 */
function BrandHeader() {
  return (
    <div className="flex flex-col items-center gap-4 border-b border-gray-100 px-6 pb-8 pt-14 md:gap-4 md:border-0 md:px-10 md:pb-6 md:pt-8 lg:hidden">
      <img
        src={logoColor}
        alt="Marty Global LLC"
        className="h-16 w-40 object-contain md:h-[60px] md:w-[180px]"
      />
      <h1 className="hidden text-[28px] font-bold leading-none text-primary md:block">
        Check Your Email
      </h1>
    </div>
  );
}

function RightPanel() {
  return (
    <div className="flex flex-1 flex-col bg-white lg:min-h-screen lg:items-center lg:justify-between lg:px-24 lg:py-24 xl:w-[792px] xl:flex-none xl:shrink-0">
      <BrandHeader />

      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 pb-6 pt-6 md:px-12 md:py-16 lg:p-0">
        <SuccessCard />
      </div>

      {/* Mobile & tablet: trust note sits after the card. Desktop: pinned to the panel base. */}
      <SecureTrust
        className="pb-10 pt-6 md:pb-0 md:pt-0 lg:hidden"
        textClassName="text-small leading-none text-text-secondary"
      />
      <SecureTrust
        className="hidden lg:flex"
        textClassName="text-small leading-none text-text-secondary"
      />
    </div>
  );
}

function SuccessCard() {
  return (
    <div className="flex w-full max-w-[480px] flex-col items-center gap-6 md:gap-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-status-approved-bg">
        <CheckIcon className="size-8 text-success" />
      </div>

      <div className="flex w-full flex-col items-center gap-2 text-center md:gap-3">
        {/* Mobile: Poppins SemiBold 24px. Tablet & desktop: Inter Semibold 28px. */}
        <h2 className="font-marketing text-2xl font-semibold leading-none text-text md:font-sans md:text-[28px] md:leading-none">
          Check Your Email
        </h2>
        <p className="text-body leading-[22px] text-text-secondary">
          We&apos;ve sent a password reset link to{' '}
          <span className="font-semibold text-text">{SENT_TO_EMAIL}</span>. It may
          take a few minutes to arrive.
        </p>
      </div>

      <div className="h-px w-full bg-gray-200" />

      <Link
        to={LOGIN_ROUTE}
        className="flex items-center justify-center gap-1.5 text-form-label font-semibold text-primary md:gap-1.5"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Log In
      </Link>
    </div>
  );
}

