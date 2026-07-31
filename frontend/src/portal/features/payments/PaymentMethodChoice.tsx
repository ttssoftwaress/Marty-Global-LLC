import { useEffect, useState } from 'react';
import {
  Bitcoin,
  Building2,
  CreditCard,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

import type { PaymentMethodKind, PaymentMethodOption } from '../../types/payments';

/*
 * Choosing how to pay.
 *
 * The list is NOT hardcoded here. Whether we take crypto, whether we take bank
 * transfers, and which bank accounts are live are admin settings, so the options
 * come from `GET /v1/payments/methods` — a constant in this file would offer a
 * method the backend then refuses, and would keep offering it after someone
 * switched it off.
 *
 * Card payments stay a static "coming soon" tile, because they are a later
 * deployment rather than a setting: there is no card code in either app to
 * enable (AGENTS.md, Payments). There is no card form here and never will be —
 * card entry, when it lands, is a provider-hosted element.
 *
 * A method the backend reports as unavailable renders visibly disabled with its
 * reason rather than disappearing. A customer who came here to pay by bank
 * transfer needs to see that it is temporarily off, not conclude we never took
 * one.
 */

type MethodPresentation = {
  icon: LucideIcon;
  title: string;
  iconWrapClass: string;
  iconClass: string;
  /** How this method settles, which is the sentence under the title. */
  blurb: (autoVerified: boolean) => string;
};

const PRESENTATION: Record<PaymentMethodKind, MethodPresentation> = {
  usdt_trc20: {
    icon: Bitcoin,
    title: 'Pay with USDT (TRC-20)',
    iconWrapClass: 'bg-[var(--color-status-approved-bg)]',
    iconClass: 'text-success',
    blurb: (autoVerified) =>
      autoVerified
        ? 'Send USDT on the TRON network — usually confirms in a minute or two.'
        : 'Send USDT on the TRON network — our team confirms it once it lands.',
  },
  wire_transfer: {
    icon: Building2,
    title: 'Pay by bank transfer',
    iconWrapClass: 'bg-primary-light',
    iconClass: 'text-primary',
    blurb: () =>
      'Send from your bank using the details we show you — our team confirms it once it arrives.',
  },
};

type PaymentMethodChoiceProps = {
  methods: PaymentMethodOption[];
  isLoading: boolean;
  isError: boolean;
  /** The method whose intent is being created, if any. */
  startingKind: PaymentMethodKind | null;
  disabled?: boolean;
  onSelect: (kind: PaymentMethodKind, bankAccountId?: string) => void;
};

export function PaymentMethodChoice({
  methods,
  isLoading,
  isError,
  startingKind,
  disabled,
  onSelect,
}: PaymentMethodChoiceProps) {
  const wire = methods.find((method) => method.kind === 'wire_transfer');

  /*
   * Which bank account the customer is sending to. Defaults to the first, so a
   * deployment with a single account never shows a picker at all — the common
   * case should not cost a decision.
   */
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    const accounts = wire?.accounts ?? [];
    // Re-seed if the list changed under us and the selection no longer exists.
    setAccountId((current) =>
      current && accounts.some((account) => account.id === current)
        ? current
        : (accounts[0]?.id ?? null),
    );
  }, [wire?.accounts]);

  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-5 lg:p-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 font-semibold text-text">Choose how to pay</h2>
        <p className="text-body text-gray-500">
          Your payment is confirmed before your order moves forward.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="h-[4.75rem] w-full animate-pulse rounded-card bg-gray-200"
              />
            ))}
          </div>
        ) : isError ? (
          /* A failed fetch is not "no methods": saying we take nothing when the
             request simply failed would send a paying customer away. */
          <p
            role="alert"
            className="rounded-card border border-gray-200 bg-gray-50 p-4 text-body text-text-secondary"
          >
            We couldn&apos;t load the payment options just now. Reload the page to
            try again.
          </p>
        ) : methods.length === 0 ? (
          <p className="rounded-card border border-dashed border-gray-300 p-4 text-body text-text-secondary">
            No payment method is available right now. Get in touch and we&apos;ll
            arrange it with you directly.
          </p>
        ) : (
          methods.map((method) => {
            const presentation = PRESENTATION[method.kind];
            if (!presentation) return null;

            const isWire = method.kind === 'wire_transfer';
            const accounts = method.accounts;
            const isStarting = startingKind === method.kind;

            return (
              <div key={method.kind} className="flex flex-col gap-2">
                <MethodButton
                  presentation={presentation}
                  method={method}
                  isStarting={isStarting}
                  disabled={Boolean(disabled) || !method.available || isStarting}
                  onSelect={() =>
                    onSelect(method.kind, isWire ? (accountId ?? undefined) : undefined)
                  }
                />

                {/* The account picker only earns its place when there is a
                    genuine choice; a single account is simply what you get. */}
                {isWire && method.available && accounts.length > 1 ? (
                  <label className="flex flex-col gap-1.5 pl-1">
                    <span className="text-caption font-semibold uppercase tracking-[0.6px] text-gray-500">
                      Send to
                    </span>
                    <select
                      value={accountId ?? ''}
                      onChange={(event) => setAccountId(event.target.value)}
                      disabled={disabled || isStarting}
                      className="input h-11 w-full text-body"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.label} · {account.currency}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            );
          })
        )}

        {/* Card — a later deployment, not a setting. Visible so a customer who
            expects to pay by card sees that it is coming. */}
        <div
          className="flex w-full items-center gap-3.5 rounded-card border border-dashed border-gray-200 bg-gray-50 p-4"
          aria-disabled="true"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-input bg-gray-200">
            <CreditCard className="size-5 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-semibold text-gray-500">Pay by card</span>
            <span className="text-small text-gray-400">
              Card payments are coming soon.
            </span>
          </span>

          <span className="status-badge status-draft shrink-0 px-2.5 text-small font-medium">
            Soon
          </span>
        </div>
      </div>
    </section>
  );
}

function MethodButton({
  presentation,
  method,
  isStarting,
  disabled,
  onSelect,
}: {
  presentation: MethodPresentation;
  method: PaymentMethodOption;
  isStarting: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const Icon = presentation.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center gap-3.5 rounded-card border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary hover:bg-primary-light disabled:cursor-default disabled:opacity-60 disabled:hover:border-gray-200 disabled:hover:bg-white"
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-input ${
          method.available ? presentation.iconWrapClass : 'bg-gray-200'
        }`}
      >
        {isStarting ? (
          <Loader2
            className={`size-5 animate-spin ${presentation.iconClass}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : (
          <Icon
            className={`size-5 ${method.available ? presentation.iconClass : 'text-gray-400'}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`text-body font-semibold ${
            method.available ? 'text-text' : 'text-gray-500'
          }`}
        >
          {presentation.title}
        </span>
        <span
          className={`text-small ${
            method.available ? 'text-text-secondary' : 'text-gray-400'
          }`}
        >
          {isStarting
            ? 'Preparing your payment details…'
            : /* The backend's own sentence when it is off — the reason is a
                 business fact, not a status code the browser should phrase. */
              (method.unavailableReason ??
              presentation.blurb(method.autoVerified))}
        </span>
      </span>
    </button>
  );
}
