import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { SavedPaymentMethod } from '../../types/billing';
import { CardBrandBadge, cardBrandName, formatCardExpiry } from './card';

/*
 * Saved payment methods — the customer's cards plus an "add" affordance. The
 * card markup differs by breakpoint (the three links diverge here), so two
 * arrangements are rendered and swapped:
 *   - mobile & desktop: vertical cards (brand + default badge on top, details,
 *     Remove at the foot). Desktop lines them up in a 3-up row; mobile stacks.
 *   - tablet: horizontal rows (brand + details on the left, badge/actions on
 *     the right) stacked full-width.
 *
 * Adding a card opens the branded Stripe Elements flow (AGENTS.md, Payments);
 * that route lands as it's built. Remove / Set as default are card mutations —
 * wired to their handlers when the billing endpoints exist.
 */

// The add-card flow (SetupIntent + Stripe Elements) lives under billing.
const ADD_METHOD_HREF = '/app/billing/methods/new';

type SavedPaymentMethodsProps = {
  methods: SavedPaymentMethod[];
  onRemove?: (id: string) => void;
  onSetDefault?: (id: string) => void;
};

function DefaultBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-pill bg-primary-light px-2.5 py-1 text-small font-semibold text-primary">
      Default
    </span>
  );
}

function SetDefaultButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-small font-semibold text-primary transition-colors hover:underline"
    >
      Set as default
    </button>
  );
}

function RemoveButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-small font-semibold text-gray-500 transition-colors hover:text-error"
    >
      Remove
    </button>
  );
}

function AddMethodInner({ compact }: { compact?: boolean }) {
  return (
    <>
      <span
        className={`flex items-center justify-center rounded-[20px] bg-primary-light ${compact ? 'size-8' : 'size-10'}`}
      >
        <Plus
          className={`text-primary ${compact ? 'size-4' : 'size-5'}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <span className="text-body font-semibold text-primary">Add payment method</span>
    </>
  );
}

export function SavedPaymentMethods({
  methods,
  onRemove,
  onSetDefault,
}: SavedPaymentMethodsProps) {
  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-h6 font-semibold text-text lg:text-h4">
        Saved payment methods
      </h2>

      {/*
       * Mobile stack + desktop row of vertical cards. Hidden at the tablet
       * width, which uses the horizontal rows below.
       */}
      <div className="flex flex-col gap-3 md:hidden lg:grid lg:grid-cols-3 lg:gap-4">
        {methods.map((method) => (
          <div
            key={method.id}
            className="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <CardBrandBadge brand={method.card.brand} />
              {method.isDefault ? (
                <DefaultBadge />
              ) : (
                <SetDefaultButton onClick={onSetDefault && (() => onSetDefault(method.id))} />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-body font-semibold text-text">
                {cardBrandName(method.card.brand)} ending in {method.card.last4}
              </p>
              <p className="text-small text-gray-500">
                Expires {formatCardExpiry(method.expMonth, method.expYear)}
              </p>
            </div>
            <div className="flex justify-end">
              <RemoveButton onClick={onRemove && (() => onRemove(method.id))} />
            </div>
          </div>
        ))}

        <Link
          to={ADD_METHOD_HREF}
          className="flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-gray-300 bg-white p-5 text-center transition-colors hover:border-primary hover:bg-primary-light lg:min-h-[162px]"
        >
          <AddMethodInner />
        </Link>
      </div>

      {/* Tablet — horizontal rows */}
      <div className="hidden flex-col gap-3 md:flex lg:hidden">
        {methods.map((method) => (
          <div
            key={method.id}
            className="flex items-center justify-between gap-3 rounded-card border border-gray-200 bg-white p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <CardBrandBadge brand={method.card.brand} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-body font-semibold text-text">
                  {cardBrandName(method.card.brand)} ending in {method.card.last4}
                </p>
                <p className="text-small text-gray-500">
                  Expires {formatCardExpiry(method.expMonth, method.expYear)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {method.isDefault ? (
                <DefaultBadge />
              ) : (
                <SetDefaultButton onClick={onSetDefault && (() => onSetDefault(method.id))} />
              )}
              <RemoveButton onClick={onRemove && (() => onRemove(method.id))} />
            </div>
          </div>
        ))}

        <Link
          to={ADD_METHOD_HREF}
          className="flex h-16 items-center justify-center gap-3 rounded-card border border-dashed border-gray-300 bg-white transition-colors hover:border-primary hover:bg-primary-light"
        >
          <AddMethodInner compact />
        </Link>
      </div>
    </section>
  );
}
