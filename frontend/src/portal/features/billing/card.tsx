import type { CardBrand, CardSummary } from '../../types/billing';

/*
 * Card network presentation — the display name, the masked "•••• 4242" label,
 * the "08/28" expiry, and the little brand badge (VISA / MC …). Card-network
 * colors are the one place a raw hex is right: they're brand marks, the
 * documented exception to the no-hardcoded-hex rule (Design guide, Icons).
 */

const BRAND_NAME: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  unknown: 'Card',
};

export function cardBrandName(brand: CardBrand): string {
  return BRAND_NAME[brand] ?? BRAND_NAME.unknown;
}

// "Visa •••• 4242" — brand name + masked last four. Never a full PAN.
export function formatCardLabel({ brand, last4 }: CardSummary): string {
  return `${cardBrandName(brand)} •••• ${last4}`;
}

// "08/28" — two-digit month / two-digit year.
export function formatCardExpiry(month: number, year: number): string {
  const mm = String(month).padStart(2, '0');
  const yy = String(year % 100).padStart(2, '0');
  return `${mm}/${yy}`;
}

const BRAND_BADGE: Record<CardBrand, { label: string; className: string }> = {
  visa: { label: 'VISA', className: 'bg-[#1a1f71] text-white' },
  mastercard: { label: 'MC', className: 'bg-gray-900 text-[#eb001b]' },
  amex: { label: 'AMEX', className: 'bg-[#2e77bc] text-white' },
  discover: { label: 'DISC', className: 'bg-[#f68121] text-white' },
  unknown: { label: 'CARD', className: 'bg-gray-700 text-white' },
};

export function CardBrandBadge({ brand }: { brand: CardBrand }) {
  const { label, className } = BRAND_BADGE[brand] ?? BRAND_BADGE.unknown;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[6px] px-2.5 py-1 text-[11px] font-extrabold leading-none tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}
