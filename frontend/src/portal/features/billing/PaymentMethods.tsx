import { Bitcoin, CreditCard } from 'lucide-react';

/*
 * How payments are collected, as the billing screen states it.
 *
 * This section used to list saved cards. Card payments are a later deployment —
 * there is no card vertical behind it — so rather than an empty "Saved payment
 * methods" list with an add button that goes nowhere, it says plainly what we
 * take today and what is coming. A customer who expects to pay by card should
 * see that it's on the way, not conclude we don't take cards.
 *
 * Nothing here is per-customer, so it reads no data: with one method and no
 * stored instruments there is nothing about it that varies by account.
 */

function MethodRow({
  icon,
  title,
  body,
  soon,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  soon?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-card border p-4 ${
        soon ? 'border-dashed border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
      }`}
      aria-disabled={soon || undefined}
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-input ${
          soon ? 'bg-gray-200' : 'bg-[var(--color-status-approved-bg)]'
        }`}
      >
        {icon}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`text-body font-semibold ${soon ? 'text-gray-500' : 'text-text'}`}
        >
          {title}
        </span>
        <span className={`text-small ${soon ? 'text-gray-400' : 'text-text-secondary'}`}>
          {body}
        </span>
      </span>

      {soon ? (
        <span className="status-badge status-draft shrink-0 px-2.5 text-small font-medium">
          Soon
        </span>
      ) : null}
    </div>
  );
}

export function PaymentMethods() {
  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-h6 font-semibold text-text lg:text-h4">Payment methods</h2>

      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
        <MethodRow
          icon={
            <Bitcoin className="size-5 text-success" strokeWidth={1.75} aria-hidden="true" />
          }
          title="USDT (TRC-20)"
          body="Send USDT on the TRON network. Your payment is confirmed on-chain before your order moves forward."
        />

        <MethodRow
          soon
          icon={
            <CreditCard className="size-5 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
          }
          title="Pay by card"
          body="Card payments are coming soon. You'll be able to save a card here once they land."
        />
      </div>
    </section>
  );
}
