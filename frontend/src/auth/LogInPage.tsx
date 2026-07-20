import { useState } from 'react';
import { Link } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import logoColor from '@/assets/Marty-Logo-Color.PNG';
import {
  CheckIcon,
  EyeIcon,
  ShieldCheckIcon,
  StarIcon,
} from './components/icons';

const RESET_PASSWORD_ROUTE = '/reset-password';
const SIGNUP_ROUTE = '/signup';

export function LogInPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-stretch bg-white lg:flex-row">
      <LeftPanel />
      <RightPanel />
    </div>
  );
}

/*
 * Mobile & tablet brand header — the navy left panel is desktop-only, so below
 * lg the color logo leads the page. On tablet the header also carries the navy
 * "Welcome Back" title per the Figma tablet design.
 */
function BrandHeader() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pb-10 pt-14 md:px-10 md:pb-6 md:pt-8 lg:hidden">
      <img
        src={logoColor}
        alt="Marty Global LLC"
        className="h-[100px] w-[200px] object-contain md:h-[60px] md:w-[180px]"
      />
      <h1 className="hidden text-[28px] font-bold leading-none text-primary md:block">
        Welcome Back
      </h1>
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
          <h1 className="text-marketing-h2">Welcome Back to Marty Global</h1>
          <p className="text-body-lg leading-[26px] opacity-80">
            Log in to manage your company filings, banking applications, and
            e-commerce setups globally.
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
        <span className="rounded-pill bg-[#10b981] px-2.5 py-1 text-caption font-semibold text-white">
          SECURE
        </span>
      </div>
    </div>
  );
}

function RightPanel() {
  return (
    <div className="flex flex-1 flex-col bg-white lg:items-center lg:justify-center lg:px-12 lg:py-16 xl:px-[88px]">
      <BrandHeader />

      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 pb-12 pt-8 md:px-12 md:py-16 lg:p-0">
        <div className="flex w-full max-w-[480px] flex-col gap-8 md:w-[352px] md:max-w-none md:gap-7 lg:w-[480px] lg:max-w-none lg:gap-8">
          <FormHeader />
          <LogInForm />
        </div>
      </div>
    </div>
  );
}

/*
 * The form heading copy differs by breakpoint per Figma: mobile reads
 * "Log In / Access your secure corporate dashboard.", while tablet and desktop
 * read "Welcome Back / Log in to manage your services and orders.".
 */
function FormHeader() {
  return (
    <div className="flex flex-col gap-1.5 lg:gap-2">
      <h2 className="text-[26px] font-semibold leading-none text-text md:text-2xl lg:text-[28px]">
        <span className="md:hidden">Log In</span>
        <span className="hidden md:inline">Welcome Back</span>
      </h2>
      <p className="text-[15px] leading-[1.5] text-text-secondary md:text-[13px] lg:text-body">
        <span className="md:hidden">Access your secure corporate dashboard.</span>
        <span className="hidden md:inline">
          Log in to manage your services and orders.
        </span>
      </p>
    </div>
  );
}

function LogInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <form
      className="flex flex-col gap-8 md:gap-7 lg:gap-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-5 md:gap-4 lg:gap-5">
        <Field label="Email Address" htmlFor="email">
          <input
            id="email"
            type="email"
            placeholder="hello@company.com"
            className="input-field md:h-11 md:rounded-lg lg:h-12 lg:rounded-input"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 md:gap-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={remember}
            onClick={() => setRemember((v) => !v)}
            className={`flex size-4 shrink-0 items-center justify-center rounded transition-colors md:size-[14px] md:rounded-[3px] ${
              remember
                ? 'bg-primary text-white'
                : 'border border-gray-300 bg-gray-50 text-transparent'
            }`}
          >
            <CheckIcon className="h-2 w-2.5" />
          </button>
          <span className="text-[13px] leading-none text-text-secondary md:text-xs">
            Remember Me
          </span>
        </label>

        <Link
          to={RESET_PASSWORD_ROUTE}
          className="text-[13px] font-medium leading-none text-primary md:text-xs"
        >
          Forgot Password?
        </Link>
      </div>

      <div className="flex flex-col gap-5 md:gap-4 lg:gap-5">
        <button
          type="submit"
          className="btn btn-primary h-12 w-full rounded-input text-[15px] md:h-11 md:rounded-lg md:text-body lg:h-12 lg:rounded-input lg:text-button"
        >
          Log In
        </button>

        <div className="flex items-center gap-3 lg:gap-4">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-[13px] text-text-secondary md:text-xs">or</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <p className="text-center text-[13px] text-text-secondary lg:text-body">
          Don&apos;t have an account?{' '}
          <Link
            to={SIGNUP_ROUTE}
            className="font-semibold text-primary"
          >
            Sign Up
          </Link>
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 pt-3 md:gap-1.5 md:pt-0">
        <ShieldCheckIcon className="size-4 shrink-0 text-text-secondary md:size-3.5" />
        <p className="text-xs leading-none text-text-secondary md:text-[11px]">
          Your information is encrypted and secure.
        </p>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
};

function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-form-label text-text md:text-[13px]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

type PasswordInputProps = {
  id: string;
  visible: boolean;
  onToggle: () => void;
};

function PasswordInput({ id, visible, onToggle }: PasswordInputProps) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder="••••••••"
        className="input-field pr-11 md:h-11 md:rounded-lg lg:h-12 lg:rounded-input"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-4 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-gray-500 md:size-[18px]"
      >
        <EyeIcon className="size-full" />
      </button>
    </div>
  );
}
