import { Bitcoin, CreditCard, Loader2 } from 'lucide-react';

/*
 * Choosing how to pay. The architecture has two methods; only USDT is built, so
 * the card option renders visibly but disabled rather than being hidden — a
 * customer who expects to pay by card should see that it's coming, not conclude
 * we don't take cards.
 *
 * Card entry, when it lands, is Stripe Elements (Design guide: never a
 * hand-rolled card input), which is why there is no card form anywhere here.
 */

type PaymentMethodChoiceProps = {
  onSelectUsdt: () => void;
  isStarting: boolean;
  disabled?: boolean;
};

export function PaymentMethodChoice({
  onSelectUsdt,
  isStarting,
  disabled,
}: PaymentMethodChoiceProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-5 lg:p-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 font-semibold text-text">Choose how to pay</h2>
        <p className="text-body text-gray-500">
          Your payment is confirmed on-chain before your order moves forward.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onSelectUsdt}
          disabled={disabled || isStarting}
          className="flex w-full items-center gap-3.5 rounded-card border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary hover:bg-primary-light disabled:cursor-default disabled:opacity-60 disabled:hover:border-gray-200 disabled:hover:bg-white"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-input bg-[var(--color-status-approved-bg)]">
            {isStarting ? (
              <Loader2
                className="size-5 animate-spin text-success"
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <Bitcoin className="size-5 text-success" strokeWidth={1.75} aria-hidden="true" />
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-semibold text-text">
              Pay with USDT (TRC-20)
            </span>
            <span className="text-small text-text-secondary">
              {isStarting
                ? 'Preparing your payment details…'
                : 'Send USDT on the TRON network — usually confirms in a minute or two.'}
            </span>
          </span>
        </button>

        <div
          className="flex w-full items-center gap-3.5 rounded-card border border-dashed border-gray-200 bg-gray-50 p-4"
          aria-disabled="true"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-input bg-gray-200">
            <CreditCard className="size-5 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-semibold text-gray-500">
              Pay by card
            </span>
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
