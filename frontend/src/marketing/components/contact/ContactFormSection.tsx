import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';

import { ApiError } from '@/services/api';
import { ClockIcon, MailIcon, PhoneIcon } from '../icons';
import { Turnstile } from '../chat/Turnstile';
import { useSubmitContactForm } from './queries';

/*
 * Contact page — main content section. Sits below the hero. A two-column
 * layout: a left intro column (heading, supportive copy, and the direct
 * contact details as icon-tile rows, plus quick links) and a right message
 * card. On desktop they sit side by side; on tablet and mobile they stack with
 * the form leading. Three breakpoints:
 *   - mobile (<768px):  px-4 py-12, stacked, 32px gap. Intro copy full-width;
 *     detail rows with 40px icon tiles; form card p-5 with 44px inputs.
 *   - tablet (md, 768px): px-10 py-16, stacked, 40px gap, centered content
 *     capped at a readable width; form card p-8 with 48px inputs.
 *   - desktop (lg, 1024px): px-20 py-20, two columns — intro 1fr, form 480px —
 *     with 64px gutter; the form card is elevated white on the gray page.
 * The mail, phone, and clock glyphs reuse the shared marketing icon set.
 * Posts to the public `/contact` endpoint — rate-limited and Turnstile-verified
 * server-side (AGENTS.md); the browser never calls a third party directly.
 */

const DETAILS = [
  {
    Icon: MailIcon,
    label: 'Email us',
    value: 'hello@martgloballlc.com',
    href: 'mailto:hello@martgloballlc.com',
  },
  {
    Icon: PhoneIcon,
    label: 'Call us',
    value: '+1 (555) 123-4567',
    href: 'tel:+15551234567',
  },
  {
    Icon: ClockIcon,
    label: 'Office hours',
    value: 'Mon–Fri, 9am–6pm (Global Support)',
    href: undefined,
  },
];

export function ContactFormSection() {
  return (
    <section className="w-full bg-gray-50 px-4 py-12 md:px-10 md:py-16 lg:px-20 lg:py-20">
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-stretch gap-8 md:gap-10 lg:max-w-[1200px] lg:flex-row lg:items-start lg:gap-16">
        <IntroColumn />
        <FormCard />
      </div>
    </section>
  );
}

function IntroColumn() {
  return (
    <div className="flex w-full flex-col items-start gap-6 md:gap-8 lg:flex-1 lg:pt-2">
      <div className="flex flex-col items-start gap-3 md:gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-accent">
          Contact Us
        </span>
        <h2 className="font-marketing text-[28px] font-bold leading-[1.2] text-text md:text-[36px] lg:text-[40px]">
          Still Have Questions?
        </h2>
        <p className="max-w-[460px] text-[14px] font-normal leading-[22px] text-text-secondary md:text-[16px] md:leading-[26px]">
          Our team is here to help — send us a message and we&apos;ll get back
          to you within 24 hours. Prefer to reach us directly? Use any of the
          channels below.
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-3 md:gap-4">
        {DETAILS.map(({ Icon, label, value, href }) => (
          <DetailRow
            key={label}
            Icon={Icon}
            label={label}
            value={value}
            href={href}
          />
        ))}
      </div>

      {/*
       * These were dead `#` anchors. Both now point at real routes — the FAQ
       * has its own page, so this no longer reaches it by hash into /services.
       */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1 text-[14px] font-semibold text-primary">
        <Link to="/services" className="inline-flex items-center gap-1 hover:underline">
          Browse Services →
        </Link>
        <Link to="/faq" className="inline-flex items-center gap-1 hover:underline">
          View FAQ →
        </Link>
      </div>
    </div>
  );
}

type DetailRowProps = {
  Icon: (props: { className?: string }) => ReactNode;
  label: string;
  value: string;
  href?: string;
};

function DetailRow({ Icon, label, value, href }: DetailRowProps) {
  const content = (
    <div className="flex w-full items-center gap-4 rounded-card border border-gray-200 bg-white p-3 shadow-sm-elevation transition-shadow group-hover:shadow-md-elevation md:p-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-primary md:size-12">
        <Icon className="size-5" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[12px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </span>
        <span className="truncate text-[14px] font-semibold text-text md:text-[15px]">
          {value}
        </span>
      </div>
    </div>
  );

  if (!href) {
    return <div className="group w-full">{content}</div>;
  }

  return (
    <a href={href} className="group w-full">
      {content}
    </a>
  );
}

function FormCard() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  const submitForm = useSubmitContactForm();
  const canSubmit =
    name.trim().length > 0 && email.trim().length > 3 && message.trim().length > 0;

  const submit = () => {
    if (!canSubmit || submitForm.isPending) return;
    setError(null);

    submitForm.mutate(
      { name: name.trim(), email: email.trim(), message: message.trim(), turnstileToken },
      {
        onError: (cause) =>
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Could not send your message. Please try again.',
          ),
      },
    );
  };

  if (submitForm.isSuccess) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white p-8 text-center shadow-lg-elevation lg:w-[480px] lg:shrink-0">
        <CheckCircle className="size-10 text-primary" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="text-[18px] font-semibold text-text md:text-[20px]">
          Message sent
        </h3>
        <p className="text-[13px] leading-[18px] text-text-secondary md:text-[14px] md:leading-normal">
          Thanks for reaching out — our team will get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-start gap-5 rounded-card border border-gray-200 bg-white p-5 shadow-lg-elevation md:gap-6 md:p-8 lg:w-[480px] lg:shrink-0">
      <div className="flex flex-col items-start gap-1.5">
        <h3 className="text-[18px] font-semibold text-text md:text-[20px]">
          Send us a message
        </h3>
        <p className="text-[13px] font-normal leading-[18px] text-text-secondary md:text-[14px] md:leading-normal">
          Fill in the form and our team will be in touch shortly.
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-4 md:gap-5">
        <CompactField
          label="Your Name"
          placeholder="Jane Cooper"
          value={name}
          onChange={setName}
          autoComplete="name"
          maxLength={80}
        />
        <CompactField
          label="Email"
          placeholder="jane@example.com"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          maxLength={200}
        />
        <div className="flex w-full flex-col items-start gap-1.5 md:gap-2">
          <label
            htmlFor="contact-message"
            className="text-[13px] font-medium text-text md:text-[14px]"
          >
            Message
          </label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us how we can help..."
            maxLength={2_000}
            rows={4}
            className="h-28 w-full resize-none rounded-[10px] border border-gray-300 bg-white p-4 text-[13px] text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)] md:h-32 md:text-[14px]"
          />
        </div>

        <Turnstile onToken={setTurnstileToken} />

        {error ? (
          <p role="alert" className="text-[13px] text-error md:text-[14px]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitForm.isPending}
          className={`flex w-full items-center justify-center gap-2 rounded-control px-6 py-3 text-[15px] font-semibold transition-colors md:py-3.5 md:text-[16px] ${
            canSubmit && !submitForm.isPending
              ? 'bg-primary text-white hover:bg-primary-hover'
              : 'cursor-not-allowed bg-gray-200 text-gray-400'
          }`}
        >
          {submitForm.isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : null}
          {submitForm.isPending ? 'Sending message…' : 'Send Message'}
        </button>

        {/*
         * The form collects a name, an email, and free-text that often carries
         * business details, so the privacy notice belongs at the point of
         * submission — not only in the footer. Placed under the button because
         * that is where a reader looks before sending.
         */}
        <p className="text-[12px] leading-[18px] text-text-secondary">
          By sending this message you agree to our{' '}
          <Link
            to="/legal/privacy"
            className="font-medium text-primary underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          . We use your details only to reply — never to sell or share.
        </p>
      </div>
    </div>
  );
}

type CompactFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
};

function CompactField({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  autoComplete,
  maxLength,
}: CompactFieldProps) {
  const inputId = `contact-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex w-full flex-col items-start gap-1.5 md:gap-2">
      <label htmlFor={inputId} className="text-[13px] font-medium text-text md:text-[14px]">
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="h-11 w-full rounded-[10px] border border-gray-300 bg-white px-4 text-[13px] text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)] md:h-12 md:text-[14px]"
      />
    </div>
  );
}
