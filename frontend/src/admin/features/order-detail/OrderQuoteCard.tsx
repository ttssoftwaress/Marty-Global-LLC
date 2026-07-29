import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Send, Trash2 } from 'lucide-react';

import { ApiError } from '@/services/api';
import { formatMoney, formatOrderDate } from '../../lib/format';
import type {
  AdminQuote,
  AdminQuoteTemplate,
  CreateQuoteInput,
} from '../../types/order-detail';
import { SectionCard } from './SectionCard';
import {
  useAdminOrderQuotes,
  useAdminQuoteTemplates,
  useCancelAdminQuote,
  useCreateAdminQuote,
} from './queries';

/*
 * Quote — the staff side of pricing an order: what has already been offered, and
 * the composer that sends a new one.
 *
 * MONEY (AGENTS.md): the wire is integer minor units, so every amount entered
 * here is parsed from a major-unit string to cents at the boundary and never
 * touched by float arithmetic afterwards. `toMinorUnits` below is the single
 * place that conversion happens — the totals it feeds are integer sums, and the
 * preview is formatted by the same helper the rest of the admin uses.
 *
 * The card renders nothing when the signed-in member lacks the `payments` area:
 * the quotes query 403s for them, and a composer that cannot submit is worse
 * than no composer. Pricing is a billing decision, not part of `orders`.
 */

type DraftLine = { id: string; label: string; amount: string };

const newLine = (id: string): DraftLine => ({ id, label: '', amount: '' });

/*
 * The copy for a failed write: the backend's own message when it sent one, our
 * fallback otherwise. Never the raw error — the API returns a code and the
 * wording is ours (AGENTS.md, API Conventions).
 */
function errorText(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : fallback;
}

/*
 * A major-unit string ("1250.50") to integer minor units (125050).
 *
 * Parsed as text rather than with `Math.round(Number(x) * 100)`: that multiply
 * is exactly the float arithmetic AGENTS.md forbids on money, and it silently
 * mis-rounds values like 1.005. Splitting on the decimal point and padding the
 * fraction to two digits keeps the whole conversion in integer space.
 *
 * Returns null for anything that is not a well-formed amount, which is what
 * keeps a half-typed line out of the total.
 */
export function toMinorUnits(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;

  const [, sign, whole, fraction = ''] = match;
  const minor = Number(`${whole}${fraction.padEnd(2, '0')}`);

  if (!Number.isSafeInteger(minor)) return null;
  return sign === '-' ? -minor : minor;
}

/*
 * Integer minor units back to the major-unit string the amount input holds
 * ("125050" → "1250.50") — the exact inverse of `toMinorUnits`, used when a
 * template fills a line.
 *
 * Integer arithmetic only, for the same reason as its inverse: `amount / 100`
 * is the float division AGENTS.md forbids on money. Splitting with `trunc` and
 * `%` keeps both halves whole and the string exact.
 */
function toMajorString(minor: number): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/*
 * The quick-select row above the composer: one chip per pricing template the
 * admin authored on the service catalog, already scoped by the backend to this
 * order's services and region.
 *
 * A chip appends a line rather than replacing the draft — a quote is often a
 * base tier plus an extra, and that is two picks. Everything stays editable
 * afterwards, so this is a shortcut past typing an agreed price, never a
 * constraint on what can be quoted.
 */
function TemplatePicker({
  templates,
  onPick,
}: {
  templates: AdminQuoteTemplate[];
  onPick: (template: AdminQuoteTemplate) => void;
}) {
  // More than one service on the order means the service name has to be on the
  // chip, or two identically-named tiers are indistinguishable.
  const multiService =
    new Set(templates.map((template) => template.serviceId)).size > 1;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-gray-500">
        Quote templates — tap to add a line, then edit as needed
      </span>

      <ul className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onPick(template)}
              title={template.description ?? undefined}
              className="flex max-w-full items-center gap-2 rounded-input border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus
                className="size-3.5 shrink-0 text-primary"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-small font-medium text-text">
                  {multiService
                    ? `${template.serviceName} — ${template.name}`
                    : template.name}
                </span>
                {template.turnaround ? (
                  <span className="truncate text-caption text-gray-500">
                    {template.turnaround}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-small font-semibold text-text">
                {formatMoney(template.price)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuoteRow({ quote, onCancel, cancelling }: {
  quote: AdminQuote;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const open = quote.status === 'pending';

  return (
    <li className="flex flex-col gap-2 rounded-input border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-body font-semibold text-text">{quote.reference}</span>
          <span className="truncate text-small text-gray-500">{quote.serviceName}</span>
        </div>
        <span className="shrink-0 text-body font-bold text-text">
          {formatMoney(quote.total)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-small text-gray-500">
          {quote.statusLabel} · {open ? 'valid until' : 'issued'}{' '}
          {formatOrderDate(open ? quote.validUntil : quote.issuedAt)}
        </span>

        {open ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="flex shrink-0 items-center gap-1.5 text-small font-medium text-error hover:underline disabled:opacity-50"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            {cancelling ? 'Withdrawing…' : 'Withdraw'}
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function OrderQuoteCard({ orderId }: { orderId: string }) {
  const quotes = useAdminOrderQuotes(orderId);
  const templates = useAdminQuoteTemplates(orderId);
  const create = useCreateAdminQuote(orderId);
  const cancel = useCancelAdminQuote(orderId);

  const [lines, setLines] = useState<DraftLine[]>([newLine('line-0')]);
  const [tax, setTax] = useState('');
  const [discount, setDiscount] = useState('');
  const [validForDays, setValidForDays] = useState('14');
  const [message, setMessage] = useState('');
  const [seq, setSeq] = useState(1);

  /*
   * The draft's arithmetic, above the early returns so it stays a hook.
   *
   * Memoised because it is not free: every line is re-parsed on every render, and
   * a render happens on every keystroke in any field on the card — including the
   * note textarea, which the totals do not depend on at all. Each line also
   * re-derives its own `invalid` flag from this same list rather than parsing a
   * second time below.
   */
  const parsedLines = useMemo(
    () => lines.map((line) => ({ ...line, minor: toMinorUnits(line.amount) })),
    [lines],
  );

  const totals = useMemo(() => {
    const complete = parsedLines.filter(
      (line) => line.label.trim() !== '' && line.minor !== null,
    );

    // Integer sums only — the same arithmetic the backend repeats authoritatively.
    const subtotal = complete.reduce((sum, line) => sum + (line.minor ?? 0), 0);
    const taxMinor = toMinorUnits(tax) ?? 0;
    const discountMinor = toMinorUnits(discount) ?? 0;

    return {
      complete,
      subtotal,
      taxMinor,
      discountMinor,
      total: subtotal + taxMinor - discountMinor,
    };
  }, [parsedLines, tax, discount]);

  // A 403 means this member does not hold the `payments` area — the card is not
  // theirs to see, so it renders nothing rather than an error they cannot act on.
  if (quotes.error instanceof ApiError && quotes.error.status === 403) return null;

  /*
   * Both queries gate the card: the composer is only honest once the existing
   * quotes are known (an outstanding one blocks Send) and the templates have
   * settled (a chip appearing under the reviewer's cursor mid-typing is worse
   * than waiting). Derived from `isPending`, not from absent data, so a failed
   * load can never read as a still-loading one.
   */
  if (quotes.isPending || templates.isPending) {
    return (
      <div
        className="h-[28rem] w-full animate-pulse rounded-card bg-gray-200"
        aria-hidden="true"
      />
    );
  }

  // Anything other than the 403 above is transient. The composer is hidden
  // rather than shown over an unknown quote list — Send would be offered without
  // knowing whether an offer is already outstanding.
  if (quotes.isError) {
    return (
      <SectionCard title="Quote">
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="flex items-start gap-2 text-small text-error">
            <AlertCircle
              className="mt-px size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            The quotes on this order couldn&apos;t be loaded, so a new one
            can&apos;t be sent yet.
          </p>

          <button
            type="button"
            onClick={() => {
              void quotes.refetch();
              void templates.refetch();
            }}
            className="btn btn-secondary h-10 rounded-input px-4 text-small"
          >
            Try again
          </button>
        </div>
      </SectionCard>
    );
  }

  const { complete, taxMinor, discountMinor, total } = totals;

  const days = Number(validForDays);
  const daysValid = Number.isInteger(days) && days >= 1 && days <= 90;

  const outstanding = (quotes.data ?? []).some((q) => q.status === 'pending');
  const canSend =
    complete.length === lines.length &&
    complete.length > 0 &&
    total > 0 &&
    daysValid &&
    !outstanding &&
    !create.isPending;

  const addLine = () => {
    setLines((current) => [...current, newLine(`line-${seq}`)]);
    setSeq((n) => n + 1);
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (id: string) => {
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id),
    );
  };

  /*
   * A template becomes a line. It fills the first untouched row rather than
   * always appending, so the empty line the composer opens with is used up by the
   * first pick instead of being left stranded above it — an all-blank line would
   * otherwise block Send, since every line must be complete.
   *
   * The label carries the service name only when the order spans more than one,
   * matching the chip: on a single-service order "LLC Formation — Standard" on
   * every line is noise the customer reads on their invoice.
   */
  const pickTemplate = (template: AdminQuoteTemplate) => {
    const multiService =
      new Set((templates.data ?? []).map((t) => t.serviceId)).size > 1;

    const label = multiService
      ? `${template.serviceName} — ${template.name}`
      : template.name;
    const amount = toMajorString(template.price.amount);

    setLines((current) => {
      const blank = current.findIndex(
        (line) => line.label.trim() === '' && line.amount.trim() === '',
      );

      if (blank !== -1) {
        return current.map((line, index) =>
          index === blank ? { ...line, label, amount } : line,
        );
      }

      return [...current, { id: `line-${seq}`, label, amount }];
    });

    setSeq((n) => n + 1);
  };

  const onSend = () => {
    if (!canSend) return;

    const input: CreateQuoteInput = {
      lineItems: complete.map((line) => ({
        label: line.label.trim(),
        amount: line.minor as number,
      })),
      tax: taxMinor,
      discount: discountMinor,
      currency: 'USD',
      validForDays: days,
      ...(message.trim() ? { message: message.trim() } : {}),
    };

    create.mutate(input, {
      onSuccess: () => {
        setLines([newLine(`line-${seq}`)]);
        setSeq((n) => n + 1);
        setTax('');
        setDiscount('');
        setMessage('');
      },
    });
  };

  // Withdrawing is a write too — its failure was silent before, which left the
  // row sitting there as if nothing had been asked of it.
  const errorMessage =
    errorText(create.error, 'Could not send this quote. Try again.') ??
    errorText(cancel.error, 'Could not withdraw that quote. Try again.');

  return (
    <SectionCard title="Quote">
      <div className="flex flex-col gap-4">
        {quotes.data && quotes.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {quotes.data.map((quote) => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                onCancel={() => cancel.mutate(quote.id)}
                cancelling={cancel.isPending && cancel.variables === quote.id}
              />
            ))}
          </ul>
        ) : null}

        {outstanding ? (
          <p className="text-small text-gray-500">
            A quote is still awaiting payment on this order. Withdraw it before
            sending another.
          </p>
        ) : (
          <>
            {templates.data && templates.data.length > 0 ? (
              <TemplatePicker templates={templates.data} onPick={pickTemplate} />
            ) : null}

            <div className="flex flex-col gap-2">
              {parsedLines.map((line, index) => {
                const invalid = line.amount.trim() !== '' && line.minor === null;

                return (
                  <div key={line.id} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={line.label}
                      onChange={(e) => updateLine(line.id, { label: e.target.value })}
                      placeholder={index === 0 ? 'State filing fee' : 'Line description'}
                      aria-label={`Line ${index + 1} description`}
                      className="input h-10 min-w-0 flex-1 rounded-input text-body"
                    />
                    <div className="flex w-[6.875rem] shrink-0 flex-col gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.amount}
                        onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                        placeholder="0.00"
                        aria-label={`Line ${index + 1} amount in dollars`}
                        aria-invalid={invalid || undefined}
                        className="input h-10 w-full rounded-input text-right text-body"
                      />
                      {invalid ? (
                        <span className="text-caption text-error">Use 12.50</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                      className="flex size-10 shrink-0 items-center justify-center rounded-input text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 self-start text-small font-medium text-primary hover:underline"
              >
                <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Add line
              </button>
            </div>

            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-caption text-gray-500">Tax</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  placeholder="0.00"
                  className="input h-10 w-full rounded-input text-right text-body"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-caption text-gray-500">Discount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                  className="input h-10 w-full rounded-input text-right text-body"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-caption text-gray-500">Valid (days)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={validForDays}
                  onChange={(e) => setValidForDays(e.target.value)}
                  aria-invalid={!daysValid || undefined}
                  className="input h-10 w-full rounded-input text-right text-body"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-caption text-gray-500">
                Note to customer (optional)
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Anything they should know about this price."
                className="input w-full resize-none rounded-input p-2 text-body"
              />
            </label>

            <div className="flex items-center justify-between border-t border-gray-200 pt-3">
              <span className="text-body font-semibold text-text">Total</span>
              <span className="text-body-lg font-bold text-text">
                {formatMoney({ amount: total, currency: 'USD' })}
              </span>
            </div>

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="btn btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-input text-body disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {create.isPending ? 'Sending…' : 'Send quote'}
            </button>
          </>
        )}

        {errorMessage ? (
          <p className="flex items-start gap-2 text-small text-error" role="alert">
            <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {errorMessage}
          </p>
        ) : null}

        {create.isSuccess ? (
          <p className="flex items-center gap-2 text-small text-[var(--color-success)]">
            <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Quote sent to the customer.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
