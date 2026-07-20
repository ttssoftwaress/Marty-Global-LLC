import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { signIn } from '@/auth/client';
import { deviceAccountName } from '@/lib/device-account';
import { LeftPanel } from './components/auth-brand';
import {
  CheckIcon,
  EyeIcon,
  ShieldCheckIcon,
} from './components/icons';

const RESET_PASSWORD_ROUTE = '/reset-password';
const SIGNUP_ROUTE = '/signup';
// No portal/dashboard route exists yet, so a successful login returns to home.
const AFTER_LOGIN_ROUTE = '/';

// Greet the returning visitor by name when this device remembers one, otherwise
// fall back to the plain heading.
function welcomeBackText(name: string | null): string {
  return name ? `Welcome Back, ${name}` : 'Welcome Back';
}

export function LogInPage() {
  const name = deviceAccountName();

  return (
    <div className="flex min-h-screen w-full flex-col items-stretch bg-white lg:flex-row">
      <LeftPanel
        title="Welcome Back to Marty Global"
        subtitle="Log in to manage your company filings, banking applications, and e-commerce setups globally."
      />
      <RightPanel name={name} />
    </div>
  );
}

/*
 * Mobile & tablet brand header — the navy left panel is desktop-only, so below
 * lg the color logo leads the page. On tablet the header also carries the navy
 * "Welcome Back" title per the Figma tablet design.
 */
function BrandHeader({ name }: { name: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pb-10 pt-14 md:px-10 md:pb-6 md:pt-8 lg:hidden">
      <img
        src={logoColor}
        alt="Marty Global LLC"
        className="h-[100px] w-[200px] object-contain md:h-[60px] md:w-[180px]"
      />
      <h1 className="hidden text-[28px] font-bold leading-none text-primary md:block">
        {welcomeBackText(name)}
      </h1>
    </div>
  );
}

function RightPanel({ name }: { name: string | null }) {
  return (
    <div className="flex flex-1 flex-col bg-white lg:items-center lg:justify-center lg:px-12 lg:py-16 xl:px-[88px]">
      <BrandHeader name={name} />

      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 pb-12 pt-8 md:px-12 md:py-16 lg:p-0">
        <div className="flex w-full max-w-[480px] flex-col gap-8 md:w-[352px] md:max-w-none md:gap-7 lg:w-[480px] lg:max-w-none lg:gap-8">
          <FormHeader name={name} />
          <LogInForm />
        </div>
      </div>
    </div>
  );
}

/*
 * The form heading copy differs by breakpoint per Figma: mobile reads
 * "Log In / Access your secure corporate dashboard.", while tablet and desktop
 * read "Welcome Back / Log in to manage your services and orders.". When this
 * device remembers a name, the tablet/desktop heading greets the user by name.
 */
function FormHeader({ name }: { name: string | null }) {
  return (
    <div className="flex flex-col gap-1.5 lg:gap-2">
      <h2 className="text-[26px] font-semibold leading-none text-text md:text-2xl lg:text-[28px]">
        <span className="md:hidden">Log In</span>
        <span className="hidden md:inline">{welcomeBackText(name)}</span>
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

type FieldErrors = {
  email?: string;
  password?: string;
};

type FormValues = {
  email: string;
  password: string;
};

// Client-side checks give instant feedback; the backend stays the real gate.
// Email format is left to the native email input + the server.
function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.email.trim()) errors.email = 'Email address is required';
  if (!values.password) errors.password = 'Password is required';

  return errors;
}

function LogInForm() {
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

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
    const { error } = await signIn.email({
      email: values.email.trim(),
      password: values.password,
      rememberMe: remember,
    });

    if (error) {
      setSubmitting(false);
      setFormError(
        error.message ?? 'We could not log you in. Please check your details and try again.',
      );
      return;
    }

    navigate(AFTER_LOGIN_ROUTE, { replace: true });
  }

  return (
    <form
      className="flex flex-col gap-8 md:gap-7 lg:gap-8"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-5 md:gap-4 lg:gap-5">
        <Field label="Email Address" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="hello@company.com"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            className="input-field md:h-11 md:rounded-lg lg:h-12 lg:rounded-input"
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            value={values.password}
            onChange={(v) => setField('password', v)}
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

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-[13px] leading-[1.4] text-error"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-5 md:gap-4 lg:gap-5">
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary h-12 w-full rounded-input text-[15px] disabled:cursor-not-allowed disabled:opacity-50 md:h-11 md:rounded-lg md:text-body lg:h-12 lg:rounded-input lg:text-button"
        >
          {submitting ? 'Logging In…' : 'Log In'}
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
  error?: string;
  children: React.ReactNode;
};

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-form-label text-text md:text-[13px]"
      >
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
};

function PasswordInput({ id, value, onChange, visible, onToggle }: PasswordInputProps) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
