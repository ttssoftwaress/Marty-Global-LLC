import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Timer,
} from 'lucide-react';

import type { Payment, PaymentStatusView } from '../../types/payments';
import { CopyField } from './CopyField';
import { PaymentStateChip } from './chips';
import { QrCode } from './QrCode';

/*
 * The USDT (TRC-20) payment panel — what the customer looks at while paying.
 *
 * It has four faces, driven entirely by the payment's status (the backend's
 * poller is what advances it; nothing here triggers a state change):
 *
 *   awaiting_payment → send-it: QR, address, exact amount, countdown
 *   confirming       → a progress read-out of confirmation depth
 *   succeeded        → receipt
 *   failed/expired/under/overpaid → what went wrong and what happens next
 *
 * Two details are deliberate rather than decorative:
 *
 *   · The network and contract address are stated prominently. A scam TRC-20
 *     token can reuse the USDT name, and sending on the wrong network (ERC-20 to
 *     a TRON address) loses the funds. These warnings are the difference between
 *     a paid invoice and an unrecoverable mistake.
 *   · The amount is presented as exact-to-the-digit, because it is the only
 *     thing identifying which payment a transfer belongs to — TRC-20 has no memo
 *     field, so an "about right" amount becomes a mismatch a human must resolve.
 */

const NETWORK_LABEL: Record<'mainnet' | 'nile', string> = {
  mainnet: 'TRON (TRC-20) Mainnet',
  nile: 'TRON (TRC-20) Nile Testnet',
};

const EXPLORER_BASE: Record<'mainnet' | 'nile', string> = {
  mainnet: 'https://tronscan.org/#/transaction/',
  nile: 'https://nile.tronscan.org/#/transaction/',
};

// "12:45" — a plain mm:ss countdown. Time, not money, so ordinary arithmetic.
function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const tick = window.setInterval(() => setRemaining(target - Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, [target]);

  const expired = remaining <= 0;

  return (
    <p
      className={`flex items-center gap-1.5 text-small font-semibold ${
        expired ? 'text-error' : 'text-[var(--color-status-review-text)]'
      }`}
    >
      <Timer className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {expired
        ? 'This payment window has closed'
        : `Send within ${formatCountdown(remaining)}`}
    </p>
  );
}

function NetworkWarning({ network, contractAddress }: {
  network: 'mainnet' | 'nile';
  contractAddress: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-[var(--color-status-review-text)]/25 bg-[var(--color-status-review-bg)] p-3.5">
      <p className="flex items-center gap-2 text-body font-semibold text-[var(--color-status-review-text)]">
        <ShieldCheck className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Send USDT on {NETWORK_LABEL[network]} only
      </p>
      <p className="text-small leading-5 text-[var(--color-status-review-text)]">
        Funds sent on another network, or as a different token, cannot be
        recovered. Check that the token contract matches:
      </p>
      <p className="break-all rounded-input bg-white/70 px-2.5 py-1.5 font-mono text-[11px] leading-4 text-text">
        {contractAddress}
      </p>
    </div>
  );
}

function ConfirmingState({ payment }: { payment: Payment }) {
  const usdt = payment.usdt;
  const confirmations = usdt?.confirmations ?? 0;
  const required = usdt?.minConfirmations ?? 0;

  // A count out of a count — not money, so plain arithmetic is fine.
  const percent = required > 0
    ? Math.min(100, Math.round((confirmations / required) * 100))
    : 0;

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center md:py-10">
      <span className="flex size-14 items-center justify-center rounded-[28px] bg-[var(--color-status-submitted-bg)]">
        <Loader2
          className="size-7 animate-spin text-[var(--color-status-submitted-text)]"
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-h6 font-semibold text-text md:text-h5">
          We&apos;ve seen your transfer
        </h3>
        <p className="max-w-[420px] text-body text-gray-500">
          It&apos;s confirming on the TRON network. You can safely close this
          page — we&apos;ll email you as soon as it clears.
        </p>
      </div>

      <div className="flex w-full max-w-[360px] flex-col gap-2">
        <div className="h-2 w-full overflow-hidden rounded-pill bg-gray-200">
          <div
            className="h-full rounded-pill bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p
          className="text-small font-medium text-text-secondary"
          role="status"
          aria-live="polite"
        >
          {confirmations} of {required} confirmations
        </p>
      </div>

      {payment.transactionHash ? (
        <TransactionLink
          hash={payment.transactionHash}
          network={usdt?.network ?? 'nile'}
        />
      ) : null}
    </div>
  );
}

function TransactionLink({ hash, network }: { hash: string; network: 'mainnet' | 'nile' }) {
  return (
    <a
      href={`${EXPLORER_BASE[network]}${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-small font-semibold text-primary hover:underline"
    >
      View on TronScan
      <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}

function SucceededState({ payment }: { payment: Payment }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center md:py-10">
      <span className="flex size-14 items-center justify-center rounded-[28px] bg-[var(--color-status-approved-bg)]">
        <CheckCircle2 className="size-7 text-success" strokeWidth={2} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-h6 font-semibold text-text md:text-h5">Payment received</h3>
        <p className="max-w-[420px] text-body text-gray-500">
          Thank you — your payment is confirmed and your order is moving forward.
          A receipt is on its way to your email.
        </p>
      </div>

      {payment.transactionHash ? (
        <TransactionLink
          hash={payment.transactionHash}
          network={payment.usdt?.network ?? 'nile'}
        />
      ) : null}
    </div>
  );
}

function ProblemState({ payment }: { payment: Payment }) {
  const { status, settledAmountDisplay, usdt } = payment;

  const FALLBACK = {
    title: 'This payment didn’t complete',
    body: 'No transfer was received before the window closed. You can start again from your billing page — nothing has been charged.',
  };

  const copy: Partial<Record<PaymentStatusView, { title: string; body: string }>> = {
    underpaid: {
      title: 'The amount didn’t match',
      body: settledAmountDisplay
        ? `We received ${settledAmountDisplay} USDT but expected ${usdt?.amountDisplay ?? 'the quoted amount'} USDT. Our team is reviewing it and will be in touch — your funds are safe.`
        : 'The transfer we received didn’t match the quoted amount. Our team is reviewing it and will be in touch.',
    },
    overpaid: {
      title: 'You sent more than the quote',
      body: settledAmountDisplay
        ? `We received ${settledAmountDisplay} USDT against a quote of ${usdt?.amountDisplay ?? ''} USDT. Our team will contact you about the difference.`
        : 'We received more than the quoted amount. Our team will contact you about the difference.',
    },
    expired: {
      title: 'This payment window closed',
      body: 'The exchange rate we quoted is no longer valid. Start the payment again to get a fresh amount — nothing has been charged.',
    },
    failed: FALLBACK,
  };

  const { title, body } = copy[status] ?? FALLBACK;
  const isMismatch = status === 'underpaid' || status === 'overpaid';

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center md:py-10">
      <span
        className={`flex size-14 items-center justify-center rounded-[28px] ${
          isMismatch
            ? 'bg-[var(--color-status-review-bg)]'
            : 'bg-[var(--color-status-missing-bg)]'
        }`}
      >
        <AlertTriangle
          className={`size-7 ${
            isMismatch ? 'text-[var(--color-status-review-text)]' : 'text-error'
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-h6 font-semibold text-text md:text-h5">{title}</h3>
        <p className="max-w-[440px] text-body text-gray-500">{body}</p>
      </div>

      {payment.transactionHash ? (
        <TransactionLink
          hash={payment.transactionHash}
          network={usdt?.network ?? 'nile'}
        />
      ) : null}
    </div>
  );
}

function AwaitingState({ payment }: { payment: Payment }) {
  const usdt = payment.usdt;
  if (!usdt) return null;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-5 lg:p-card">
      <NetworkWarning network={usdt.network} contractAddress={usdt.contractAddress} />

      {/*
        QR and fields sit side by side from tablet up and stack on mobile, where
        the code goes first — a phone customer is most likely scanning it with a
        wallet app on the same device.
      */}
      <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:gap-6">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <QrCode value={usdt.depositAddress} size={168} />
          <p className="text-small text-text-secondary">Scan with your wallet</p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-4">
          <CopyField
            label="Amount to send"
            value={usdt.amountDisplay}
            hint="Send this exact amount — it's how we match your transfer to this invoice."
          />

          <CopyField label="Deposit address" value={usdt.depositAddress} />

          <Countdown expiresAt={usdt.expiresAt} />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-card bg-gray-50 p-3.5">
        <Loader2
          className="mt-0.5 size-4 shrink-0 animate-spin text-gray-400"
          strokeWidth={2}
          aria-hidden="true"
        />
        <p className="text-small leading-5 text-text-secondary">
          Waiting for your transfer. This page updates on its own once we see it
          on-chain — you don&apos;t need to do anything else, and it&apos;s safe
          to close this tab.
        </p>
      </div>
    </div>
  );
}

export function UsdtPaymentPanel({ payment }: { payment: Payment }) {
  const { status } = payment;

  return (
    <section className="w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3.5 md:px-5 lg:px-card">
        <h2 className="text-h6 font-semibold text-text">Pay with USDT</h2>
        <PaymentStateChip status={status} />
      </header>

      {status === 'awaiting_payment' ? <AwaitingState payment={payment} /> : null}
      {status === 'confirming' ? <ConfirmingState payment={payment} /> : null}
      {status === 'succeeded' ? <SucceededState payment={payment} /> : null}
      {['failed', 'expired', 'underpaid', 'overpaid'].includes(status) ? (
        <ProblemState payment={payment} />
      ) : null}
    </section>
  );
}
