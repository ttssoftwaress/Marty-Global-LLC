import { Link } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import logoColor from '@/assets/Marty-Logo-Color.PNG';
import {
  ArrowLeftIcon,
  CheckIcon,
  ShieldAlertIcon,
  StarIcon,
} from './components/icons';

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
      <LeftPanel />
      <RightPanel />
    </div>
  );
}

function LeftPanel() {
  return (
    <div className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-primary p-16 lg:flex lg:w-1/2 lg:shrink-0 xl:w-[648px]">
      <DotPattern />

      <div className="relative flex flex-col gap-20">
        <img
          src={logoWhite}
          alt="Marty Global LLC"
          className="h-[50px] w-[182px] object-contain object-left"
        />
        <div className="flex flex-col gap-4 text-white">
          <h1 className="text-marketing-h2">Setting Global Corporate Standards</h1>
          <p className="text-body-lg leading-[26px] opacity-80">
            Unlock corporate potential from anywhere. Mart Global manages your
            business structure so you can focus on expansion.
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
        &quot;Setting up our US entity through Mart Global was incredibly seamless.
        Their dashboard makes compliance and international trade simple.&quot;
      </p>

      <div className="h-px w-full bg-white/15" />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5 text-white">
          <p className="text-body font-semibold">10,000+ Businesses</p>
          <p className="text-small opacity-60">Managed globally across USA, UK &amp; EU</p>
        </div>
        <span className="rounded-pill bg-[#10b981] px-2.5 py-1 text-caption font-semibold text-white">
          SECURE
        </span>
      </div>
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
      <SecureTrust className="justify-center pb-10 pt-6 md:pb-0 md:pt-0 lg:hidden" />
      <SecureTrust className="hidden lg:flex" />
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

type SecureTrustProps = { className?: string };

function SecureTrust({ className }: SecureTrustProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <ShieldAlertIcon className="size-4 shrink-0 text-text-secondary" />
      <p className="text-small leading-none text-text-secondary">
        Your information is encrypted and secure.
      </p>
    </div>
  );
}
