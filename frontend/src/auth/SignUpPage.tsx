import { useState } from 'react';
import { Link } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import logoColor from '@/assets/Marty-Logo-Color.PNG';
import {
  ChevronDownIcon,
  CheckIcon,
  EyeIcon,
  ShieldCheckIcon,
  StarIcon,
} from './components/icons';

const TERMS_URL = 'https://example.com/terms';
const PRIVACY_URL = 'https://example.com/privacy';
const LOGIN_ROUTE = '/login';

export function SignUpPage() {
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
 * "Create Your Account" title per the Figma tablet design.
 */
function BrandHeader() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-10 md:px-10 md:pb-6 md:pt-8 lg:hidden">
      <img
        src={logoColor}
        alt="Marty Global LLC"
        className="h-20 w-40 object-contain md:h-[60px] md:w-[180px]"
      />
      <h1 className="hidden text-[28px] font-bold leading-none text-primary md:block">
        Create Your Account
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
          <h1 className="text-marketing-h2">Launch Your Business Across Borders</h1>
          <p className="text-body-lg leading-[26px] opacity-80">
            Start your journey with Mart Global. Form your entity, set up banking,
            and manage compliance across the USA, UK, Canada, and Europe.
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

function RightPanel() {
  return (
    <div className="flex flex-1 flex-col bg-white lg:items-center lg:justify-center lg:px-12 lg:py-16 xl:px-[88px]">
      <BrandHeader />

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-6 md:px-10 md:py-12 lg:p-0">
        <div className="flex w-full max-w-[480px] flex-col gap-6 md:gap-6 lg:gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold leading-none text-text md:text-[26px] lg:text-[28px]">
              Create Your Account
            </h2>
            <p className="text-body leading-[1.5] text-text-secondary">
              Start your journey with Mart Global LLC in just a few minutes.
            </p>
          </div>

          <SignUpForm />
        </div>
      </div>
    </div>
  );
}

function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [country, setCountry] = useState('');

  return (
    <form
      className="flex flex-col gap-5 md:gap-6 lg:gap-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
        <Field label="Full Name" htmlFor="fullName">
          <input
            id="fullName"
            type="text"
            placeholder="John Smith"
            className="input-field md:h-11 lg:h-12"
          />
        </Field>

        <Field label="Email Address" htmlFor="email">
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="input-field md:h-11 lg:h-12"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
        </Field>

        <Field label="Confirm Password" htmlFor="confirmPassword">
          <PasswordInput
            id="confirmPassword"
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />
        </Field>

        <Field label="Country / Region of Incorporation" htmlFor="country">
          <div className="relative">
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={`input-field w-full appearance-none pr-11 md:h-11 lg:h-12 ${
                country ? 'text-text' : 'text-gray-400'
              }`}
            >
              <option value="" disabled hidden>
                Select your country or region
              </option>
              <option value="us">United States</option>
              <option value="uk">United Kingdom</option>
              <option value="ca">Canada</option>
              <option value="eu">Europe</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
          </div>
        </Field>
      </div>

      <label className="flex items-center gap-2.5 md:gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={agreed}
          onClick={() => setAgreed((v) => !v)}
          className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
            agreed
              ? 'border-primary bg-primary text-white'
              : 'border-gray-300 bg-gray-50 text-transparent'
          }`}
        >
          <CheckIcon className="h-2 w-2.5" />
        </button>
        <span className="text-[13px] leading-[1.4] text-text-secondary">
          I agree to the{' '}
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline"
          >
            Privacy Policy
          </a>
        </span>
      </label>

      <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
        <button
          type="submit"
          className="btn btn-primary h-[52px] w-full rounded-xl shadow-[0px_8px_10px_rgba(3,18,109,0.15)] md:h-11 md:rounded-input md:shadow-[0px_4px_6px_rgba(3,18,109,0.1)] lg:h-12"
        >
          Create Account
        </button>

        <div className="flex items-center gap-3 md:gap-4">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-small uppercase text-gray-400">or</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <p className="text-center text-body text-text-secondary">
          Already have an account?{' '}
          <Link
            to={LOGIN_ROUTE}
            className="font-semibold text-primary underline"
          >
            Log In
          </Link>
        </p>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-[0px_2px_5px_rgba(0,0,0,0.04)] md:gap-2 md:rounded-lg md:border-[#e2e8f0] md:bg-[#f8fafc] md:shadow-none">
        <ShieldCheckIcon className="size-4 shrink-0 text-text-secondary" />
        <p className="text-small leading-[1.4] text-text-secondary">
          Your information is encrypted and secure. We never share your details
          without consent.
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
    <div className="flex flex-col gap-1.5 lg:gap-2">
      <label htmlFor={htmlFor} className="text-form-label text-text">
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
        placeholder="••••••••••••"
        className="input-field pr-11 md:h-11 lg:h-12"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-4 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-gray-500"
      >
        <EyeIcon className="size-5" />
      </button>
    </div>
  );
}
