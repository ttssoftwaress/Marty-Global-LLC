import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';

import {
  readCookieConsent,
  writeCookieConsent,
} from '@/lib/cookie-consent';

/*
 * The working half of the Cookie Policy page. The footer calls this link
 * "Cookie Settings", so it has to set something rather than only describe the
 * cookies — this panel is what the preference actually writes through.
 *
 * Two categories, because two is what the stack can honestly offer: essential
 * storage (the session and the bot-protection challenge) which cannot be turned
 * off without breaking sign-in, and analytics which is genuinely optional and
 * defaults to off until the visitor opts in.
 *
 * The toggle is marketing's own rather than the portal's — portal and marketing
 * never import from each other (AGENTS.md).
 */

type Category = {
  id: 'essential' | 'analytics';
  title: string;
  description: string;
  cookies: string;
  locked: boolean;
};

const CATEGORIES: Category[] = [
  {
    id: 'essential',
    title: 'Strictly necessary',
    description:
      'Keeps you signed in, remembers which device you created your account on, and lets our bot protection tell a person from a script. Without these you cannot sign in or submit a form, so they cannot be switched off.',
    cookies:
      'Session cookie · sign-in state · bot-protection challenge · your cookie choice itself',
    locked: true,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description:
      'Tells us which pages people read and where they get stuck, so we can fix the confusing parts. Aggregated and never used to identify you personally. Nothing analytics-related loads until you turn this on.',
    cookies: 'Product analytics — page views, referrer, anonymised session',
    locked: false,
  },
];

export function CookiePreferences() {
  const [analytics, setAnalytics] = useState(false);
  const [decidedAt, setDecidedAt] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Read once on mount rather than during render — localStorage is not
  // available while the module evaluates in every environment.
  useEffect(() => {
    const consent = readCookieConsent();
    setAnalytics(consent.analytics);
    setDecidedAt(consent.decidedAt);
  }, []);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  const save = (nextAnalytics: boolean) => {
    setAnalytics(nextAnalytics);
    const consent = writeCookieConsent(nextAnalytics);
    setDecidedAt(consent.decidedAt);
    setJustSaved(true);
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-gray-200 bg-gray-50 p-4 md:gap-5 md:p-6">
      <div className="flex flex-col gap-1.5">
        <h3 className="font-marketing text-[16px] font-semibold text-text md:text-[18px]">
          Your cookie preferences
        </h3>
        <p className="text-[13px] leading-[20px] text-text-secondary md:text-[14px] md:leading-[22px]">
          Changes take effect immediately and are remembered on this browser.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {CATEGORIES.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            checked={category.locked ? true : analytics}
            onChange={save}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p
          aria-live="polite"
          className="text-[12px] leading-[18px] text-text-secondary md:text-[13px]"
        >
          {justSaved ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <Check className="size-4" aria-hidden="true" />
              Preferences saved
            </span>
          ) : decidedAt ? (
            `Last updated ${formatDecidedAt(decidedAt)}`
          ) : (
            'No choice recorded yet — analytics is off by default.'
          )}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => save(false)}
            className="btn btn-secondary h-11 rounded-input px-5 text-[14px]"
          >
            Reject optional
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            className="btn btn-primary h-11 rounded-input px-5 text-[14px]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  checked,
  onChange,
}: {
  category: Category;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-gray-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h4 className="font-marketing text-[14px] font-semibold text-text md:text-[15px]">
            {category.title}
          </h4>
          {category.locked && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              <Lock className="size-2.5" aria-hidden="true" />
              Always on
            </span>
          )}
        </div>
        <p className="text-[13px] leading-[20px] text-text-secondary md:text-[13px] md:leading-[21px]">
          {category.description}
        </p>
        <p className="text-[11px] leading-[16px] text-gray-500">
          {category.cookies}
        </p>
      </div>

      <div className="shrink-0 sm:pt-1">
        <ConsentToggle
          checked={checked}
          disabled={category.locked}
          label={`${category.title} cookies`}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function ConsentToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        checked ? 'bg-accent' : 'bg-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm-elevation transition-transform ${
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/*
 * Rendered in the visitor's own locale and timezone — the stored value is UTC
 * (AGENTS.md: convert at render, never before).
 */
function formatDecidedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
