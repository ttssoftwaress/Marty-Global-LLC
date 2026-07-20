import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { signUp } from '@/auth/client';
import { markAccountOnDevice } from '@/lib/device-account';
import { LeftPanel } from './components/auth-brand';
import {
  ChevronDownIcon,
  CheckIcon,
  EyeIcon,
  ShieldCheckIcon,
} from './components/icons';

const TERMS_URL = 'https://example.com/terms';
const PRIVACY_URL = 'https://example.com/privacy';
const LOGIN_ROUTE = '/login';
const MIN_PASSWORD_LENGTH = 8;

export function SignUpPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-stretch bg-white lg:flex-row">
      <LeftPanel
        title="Launch Your Business Across Borders"
        subtitle="Start your journey with Marty Global. Form your entity, set up banking, and manage compliance across the USA, UK, Canada, and Europe."
      />
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
              Start your journey with Marty Global LLC in just a few minutes.
            </p>
          </div>

          <SignUpForm />
        </div>
      </div>
    </div>
  );
}

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  country?: string;
};

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  country: string;
};

// Client-side checks mirror the backend's rules (Better Auth min password length,
// required fields) so the user gets instant feedback; the backend stays the real
// gate. Email format is left to the native email input + the server.
function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.fullName.trim()) errors.fullName = 'Full name is required';
  if (!values.email.trim()) errors.email = 'Email address is required';

  if (!values.password) {
    errors.password = 'Password is required';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (!values.country) errors.country = 'Please select your country or region';

  return errors;
}

function SignUpForm() {
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setFormError(null);
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    const { error } = await signUp.email({
      name: values.fullName.trim(),
      email: values.email.trim(),
      password: values.password,
      country: values.country,
    });

    if (error) {
      setSubmitting(false);
      setFormError(
        error.message ?? 'We could not create your account. Please try again.',
      );
      return;
    }

    // Account exists — remember this device (and the name, to greet the returning
    // visitor on login) so future "Get Started" clicks route to login, then send
    // the user to sign in (no auto-login for now).
    markAccountOnDevice(values.fullName.trim());
    navigate(LOGIN_ROUTE, { replace: true });
  }

  return (
    <form className="flex flex-col gap-5 md:gap-6 lg:gap-8" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
        <Field label="Full Name" htmlFor="fullName" error={errors.fullName}>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="John Smith"
            value={values.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            className="input-field md:h-11 lg:h-12"
          />
        </Field>

        <Field label="Email Address" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            className="input-field md:h-11 lg:h-12"
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(v) => setField('password', v)}
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
        </Field>

        <Field
          label="Confirm Password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(v) => setField('confirmPassword', v)}
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />
        </Field>

        <Field
          label="Country / Region of Incorporation"
          htmlFor="country"
          error={errors.country}
        >
          <div className="relative">
            <select
              id="country"
              value={values.country}
              onChange={(e) => setField('country', e.target.value)}
              className={`input-field w-full appearance-none pr-11 md:h-11 lg:h-12 ${
                values.country ? 'text-text' : 'text-gray-400'
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

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-[13px] leading-[1.4] text-error"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
        <button
          type="submit"
          disabled={!agreed || submitting}
          className="btn btn-primary h-[52px] w-full rounded-xl shadow-[0px_8px_10px_rgba(3,18,109,0.15)] disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:rounded-input md:shadow-[0px_4px_6px_rgba(3,18,109,0.1)] lg:h-12"
        >
          {submitting ? 'Creating Account…' : 'Create Account'}
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

      <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-[0px_2px_5px_rgba(0,0,0,0.04)] md:gap-2 md:rounded-lg md:border-gray-200 md:bg-gray-50 md:shadow-none">
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
  error?: string;
  children: React.ReactNode;
};

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5 lg:gap-2">
      <label htmlFor={htmlFor} className="text-form-label text-text">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[13px] leading-[1.3] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

type PasswordInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete?: string;
};

function PasswordInput({
  id,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: PasswordInputProps) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder="••••••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
