/*
 * Money arithmetic. AGENTS.md is absolute about this: never JS floats for money
 * — no parseFloat, no Number math on amounts, no toFixed arithmetic.
 *
 * Two representations live here and never mix silently:
 *
 *   fiat  — integer minor units + an ISO 4217 code. 1250 + "USD" is $12.50.
 *   USDT  — a raw integer at 6 decimals, held as a `bigint`. 1_500_000n is
 *           1.5 USDT. bigint rather than number because a large transfer would
 *           exceed Number.MAX_SAFE_INTEGER, and a silently-rounded amount is
 *           exactly the bug this module exists to prevent.
 *
 * Every function here is pure and total: same inputs, same output, no clock, no
 * I/O. That is what makes them cheap to test exhaustively, which AGENTS.md's
 * testing section calls for by name ("money helpers").
 */

// USDT's on-chain precision. The Payment row stores this alongside the raw
// amount so a token at another precision can never be read as USDT.
export const USDT_DECIMALS = 6;

// The fixed scale the USD→USDT rate is expressed over. A rate of 1_000_000 is
// exactly 1.000000 USDT per USD; 1_010_000 is a 1% spread.
export const RATE_SCALE = 1_000_000n;

// Minor-unit exponents for the currencies we price in. Anything absent is the
// ISO 4217 default of 2.
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
};

export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * Convert a fiat amount in integer minor units to the raw USDT integer owed at
 * `rateMinor` (USDT-per-unit-of-fiat, scaled by RATE_SCALE).
 *
 * Rounds UP (ceiling). A fractional remainder means the exact amount is not
 * representable on-chain, and rounding down would ask the customer for less
 * than the invoice — quietly creating an underpayment we then have to chase.
 * The customer is never asked for more than one atomic unit (0.000001 USDT)
 * above the true figure, which is worth far less than a cent.
 *
 * All arithmetic is bigint. There is no division that can lose precision
 * silently: the remainder is checked explicitly.
 */
export function fiatMinorToUsdtRaw(
  amountMinor: number,
  currency: string,
  rateMinor: number,
): bigint {
  if (!Number.isInteger(amountMinor)) {
    throw new Error('Fiat amount must be an integer in minor units');
  }
  if (amountMinor < 0) {
    throw new Error('Fiat amount must not be negative');
  }
  if (!Number.isInteger(rateMinor) || rateMinor <= 0) {
    throw new Error('Rate must be a positive integer at RATE_SCALE');
  }

  const fiatExponent = minorUnitExponent(currency);

  // amount / 10^fiatExp  ×  rate / RATE_SCALE  ×  10^USDT_DECIMALS
  // reassociated so every division happens once, at the end, on integers.
  const numerator =
    BigInt(amountMinor) * BigInt(rateMinor) * pow10(USDT_DECIMALS);
  const denominator = pow10(fiatExponent) * RATE_SCALE;

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  // Ceiling — see the note above on why up and not down.
  return remainder === 0n ? quotient : quotient + 1n;
}

/**
 * The inverse: what a raw USDT amount is worth in fiat minor units at
 * `rateMinor`.
 *
 * Rounds DOWN (floor). This values what actually arrived, and crediting a
 * customer for more than they sent — even by one minor unit — is money we never
 * received. Under-crediting by at most a cent is the safe direction, and the
 * under/overpayment status makes any real shortfall explicit anyway.
 */
export function usdtRawToFiatMinor(
  usdtRaw: bigint,
  currency: string,
  rateMinor: number,
): number {
  if (usdtRaw < 0n) {
    throw new Error('USDT amount must not be negative');
  }
  if (!Number.isInteger(rateMinor) || rateMinor <= 0) {
    throw new Error('Rate must be a positive integer at RATE_SCALE');
  }

  const fiatExponent = minorUnitExponent(currency);

  const numerator = usdtRaw * RATE_SCALE * pow10(fiatExponent);
  const denominator = BigInt(rateMinor) * pow10(USDT_DECIMALS);

  const result = numerator / denominator;

  // The result is a fiat minor-unit count, which the rest of the codebase (and
  // Prisma's Int columns) hold as a number. Refuse rather than silently round if
  // it could not survive the conversion.
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Converted fiat amount exceeds the safe integer range');
  }

  return Number(result);
}

/**
 * Format a raw USDT integer for display — the ONE place a token amount becomes
 * a decimal string, and it is a string, never a float. Built by slicing digits
 * so the value never passes through Number.
 */
export function formatUsdtRaw(usdtRaw: bigint, decimals = USDT_DECIMALS): string {
  const negative = usdtRaw < 0n;
  const digits = (negative ? -usdtRaw : usdtRaw).toString().padStart(decimals + 1, '0');

  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');

  const body = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${body}` : body;
}

/**
 * Parse a decimal USDT string ("1.5", "0.000001") into its raw integer. Used for
 * values that arrive as text; rejects anything that isn't a plain decimal or
 * that carries more precision than the token has, rather than truncating it.
 */
export function parseUsdtDecimal(input: string, decimals = USDT_DECIMALS): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) throw new Error('Not a valid USDT decimal amount');

  const [, whole = '0', fraction = ''] = match;
  if (fraction.length > decimals) {
    throw new Error(`USDT supports at most ${decimals} decimal places`);
  }

  return BigInt(whole) * pow10(decimals) + BigInt(fraction.padEnd(decimals, '0'));
}

/**
 * How a settled on-chain amount compares to what was asked for.
 *
 * `tolerance` is an allowance in raw units for the dust a sending exchange may
 * shave off; it defaults to zero because AGENTS.md is explicit that under- and
 * overpayment are explicit statuses, never a silent pass. Callers that set a
 * tolerance are choosing to treat that band as exact, and the band is small
 * enough to be worth less than a cent.
 */
export type SettlementComparison = 'exact' | 'underpaid' | 'overpaid';

export function compareSettlement(
  receivedRaw: bigint,
  expectedRaw: bigint,
  tolerance = 0n,
): SettlementComparison {
  const difference = receivedRaw - expectedRaw;
  if (difference < 0n) {
    return -difference <= tolerance ? 'exact' : 'underpaid';
  }
  if (difference > 0n) {
    return difference <= tolerance ? 'exact' : 'overpaid';
  }
  return 'exact';
}
