import { describe, expect, it } from 'vitest';

import {
  compareSettlement,
  fiatMinorToUsdtRaw,
  formatUsdtRaw,
  minorUnitExponent,
  parseUsdtDecimal,
  RATE_SCALE,
  USDT_DECIMALS,
  usdtRawToFiatMinor,
} from './money.js';

/*
 * The money helpers. AGENTS.md names these explicitly under "Testing" because
 * they are the layer where a rounding decision becomes real money — a cent of
 * drift here is a cent we either fail to collect or wrongly credit.
 *
 * These are pure functions with no clock and no I/O, so they are tested
 * exhaustively rather than sampled: every rounding direction, every boundary,
 * and specifically the values that a float implementation would get wrong.
 */

const RATE_1_1 = 1_000_000; // 1.000000 USDT per USD

describe('minorUnitExponent', () => {
  it('defaults to two decimals and knows the exceptions', () => {
    expect(minorUnitExponent('USD')).toBe(2);
    expect(minorUnitExponent('EUR')).toBe(2);
    expect(minorUnitExponent('JPY')).toBe(0);
    expect(minorUnitExponent('KWD')).toBe(3);
    // Case-insensitive: a lowercase code is the same currency.
    expect(minorUnitExponent('jpy')).toBe(0);
  });
});

describe('fiatMinorToUsdtRaw', () => {
  it('converts USD minor units at a 1:1 peg', () => {
    // $559.50 → 559.500000 USDT
    expect(fiatMinorToUsdtRaw(55_950, 'USD', RATE_1_1)).toBe(559_500_000n);
    // $1.00 → 1.000000 USDT
    expect(fiatMinorToUsdtRaw(100, 'USD', RATE_1_1)).toBe(1_000_000n);
    // One cent → 0.010000 USDT
    expect(fiatMinorToUsdtRaw(1, 'USD', RATE_1_1)).toBe(10_000n);
  });

  it('returns a bigint, never a number', () => {
    expect(typeof fiatMinorToUsdtRaw(55_950, 'USD', RATE_1_1)).toBe('bigint');
  });

  it('handles zero', () => {
    expect(fiatMinorToUsdtRaw(0, 'USD', RATE_1_1)).toBe(0n);
  });

  it('applies a spread as an integer rate', () => {
    // +1% spread: $100.00 → 101.000000 USDT
    expect(fiatMinorToUsdtRaw(10_000, 'USD', 1_010_000)).toBe(101_000_000n);
  });

  it('rounds UP so we never ask for less than the invoice', () => {
    /*
     * A rate that does not divide evenly. Asking for less than the true figure
     * would manufacture an underpayment out of our own rounding, so the
     * remainder always rounds up — by at most one atomic unit (0.000001 USDT).
     */
    const rate = 333_333; // 0.333333 USDT per USD
    const raw = fiatMinorToUsdtRaw(1, 'USD', rate);

    // 1 cent × 0.333333 = 0.00333333 USDT → 0.003334 at 6 decimals (ceiling)
    expect(raw).toBe(3_334n);

    // Confirm it is genuinely a ceiling: the exact value is below it.
    const exact = (1n * BigInt(rate) * 10n ** BigInt(USDT_DECIMALS)) / (100n * RATE_SCALE);
    expect(raw).toBe(exact + 1n);
  });

  it('is exact for values a float would drift on', () => {
    /*
     * 0.1 + 0.2 !== 0.3 in binary floating point. In integer minor units the
     * same figures are exact, which is the entire reason for the rule.
     */
    const tenCents = fiatMinorToUsdtRaw(10, 'USD', RATE_1_1);
    const twentyCents = fiatMinorToUsdtRaw(20, 'USD', RATE_1_1);
    const thirtyCents = fiatMinorToUsdtRaw(30, 'USD', RATE_1_1);

    expect(tenCents + twentyCents).toBe(thirtyCents);
    expect(thirtyCents).toBe(300_000n);
  });

  it('handles a zero-decimal currency', () => {
    // ¥1000 is 1000 minor units at exponent 0 → 1000.000000 USDT at 1:1.
    expect(fiatMinorToUsdtRaw(1_000, 'JPY', RATE_1_1)).toBe(1_000_000_000n);
  });

  it('stays exact past the float-safe integer range', () => {
    /*
     * A value whose USDT raw amount exceeds Number.MAX_SAFE_INTEGER (~9.007e15).
     * $100,000,000,000.00 → 1e17 raw units, an order of magnitude past the point
     * where a `number` implementation starts silently rounding. bigint does not.
     */
    const huge = 10_000_000_000_000; // $100,000,000,000.00 in cents
    const raw = fiatMinorToUsdtRaw(huge, 'USD', RATE_1_1);

    expect(raw).toBe(100_000_000_000_000_000n);
    expect(raw > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);

    // The float route really does lose the value — this is the bug being avoided.
    expect(Number(raw) === Number(raw) + 1).toBe(true);
  });

  it('rejects inputs that are not integer minor units', () => {
    expect(() => fiatMinorToUsdtRaw(12.5, 'USD', RATE_1_1)).toThrow();
    expect(() => fiatMinorToUsdtRaw(-100, 'USD', RATE_1_1)).toThrow();
    expect(() => fiatMinorToUsdtRaw(100, 'USD', 0)).toThrow();
    expect(() => fiatMinorToUsdtRaw(100, 'USD', -1)).toThrow();
    expect(() => fiatMinorToUsdtRaw(100, 'USD', 1.5)).toThrow();
  });
});

describe('usdtRawToFiatMinor', () => {
  it('inverts the conversion at a 1:1 peg', () => {
    expect(usdtRawToFiatMinor(559_500_000n, 'USD', RATE_1_1)).toBe(55_950);
    expect(usdtRawToFiatMinor(1_000_000n, 'USD', RATE_1_1)).toBe(100);
  });

  it('rounds DOWN so we never credit money we did not receive', () => {
    // 0.009999 USDT is just under a cent at 1:1 — worth 0 cents, not 1.
    expect(usdtRawToFiatMinor(9_999n, 'USD', RATE_1_1)).toBe(0);
    // 1.999999 USDT → 199 cents, not 200.
    expect(usdtRawToFiatMinor(1_999_999n, 'USD', RATE_1_1)).toBe(199);
  });

  it('handles zero', () => {
    expect(usdtRawToFiatMinor(0n, 'USD', RATE_1_1)).toBe(0);
  });

  it('round-trips without gaining value', () => {
    /*
     * Ceiling out, floor back: the round trip may lose a sub-cent fraction but
     * must never gain one. Gaining would mean a customer could pay less than the
     * invoice and have it read as settled.
     */
    for (const cents of [1, 7, 99, 100, 4_999, 55_950, 123_457]) {
      const raw = fiatMinorToUsdtRaw(cents, 'USD', RATE_1_1);
      expect(usdtRawToFiatMinor(raw, 'USD', RATE_1_1)).toBe(cents);
    }
  });

  it('rejects a negative amount and a bad rate', () => {
    expect(() => usdtRawToFiatMinor(-1n, 'USD', RATE_1_1)).toThrow();
    expect(() => usdtRawToFiatMinor(100n, 'USD', 0)).toThrow();
  });

  it('refuses a value that could not survive as a safe integer', () => {
    const beyond = BigInt(Number.MAX_SAFE_INTEGER) * 1_000_000n;
    expect(() => usdtRawToFiatMinor(beyond, 'USD', RATE_1_1)).toThrow(
      /safe integer range/,
    );
  });
});

describe('formatUsdtRaw', () => {
  it('formats raw integers as decimal strings without float maths', () => {
    expect(formatUsdtRaw(559_500_000n)).toBe('559.5');
    expect(formatUsdtRaw(1_000_000n)).toBe('1');
    expect(formatUsdtRaw(1n)).toBe('0.000001');
    expect(formatUsdtRaw(0n)).toBe('0');
    expect(formatUsdtRaw(1_234_567n)).toBe('1.234567');
  });

  it('formats values beyond the float-safe range exactly', () => {
    expect(formatUsdtRaw(9_007_199_254_740_993_000_000n)).toBe(
      '9007199254740993',
    );
  });

  it('handles a negative amount', () => {
    expect(formatUsdtRaw(-1_500_000n)).toBe('-1.5');
  });
});

describe('parseUsdtDecimal', () => {
  it('parses decimal strings to raw integers', () => {
    expect(parseUsdtDecimal('1.5')).toBe(1_500_000n);
    expect(parseUsdtDecimal('0.000001')).toBe(1n);
    expect(parseUsdtDecimal('559.5')).toBe(559_500_000n);
    expect(parseUsdtDecimal('100')).toBe(100_000_000n);
  });

  it('round-trips with formatUsdtRaw', () => {
    for (const value of ['0', '1', '1.5', '0.000001', '123456.789012']) {
      expect(formatUsdtRaw(parseUsdtDecimal(value))).toBe(value);
    }
  });

  it('refuses more precision than the token has, rather than truncating', () => {
    // Truncating would silently change the amount — reject instead.
    expect(() => parseUsdtDecimal('1.0000001')).toThrow(/decimal places/);
  });

  it('refuses values that are not plain decimals', () => {
    expect(() => parseUsdtDecimal('1e6')).toThrow();
    expect(() => parseUsdtDecimal('-1')).toThrow();
    expect(() => parseUsdtDecimal('abc')).toThrow();
    expect(() => parseUsdtDecimal('')).toThrow();
  });
});

describe('compareSettlement', () => {
  it('classifies an exact match', () => {
    expect(compareSettlement(1_000_000n, 1_000_000n)).toBe('exact');
  });

  it('classifies under- and overpayment with no default tolerance', () => {
    // AGENTS.md: never a silent pass. One atomic unit short is underpaid.
    expect(compareSettlement(999_999n, 1_000_000n)).toBe('underpaid');
    expect(compareSettlement(1_000_001n, 1_000_000n)).toBe('overpaid');
  });

  it('treats a difference inside an explicit tolerance as exact', () => {
    expect(compareSettlement(999_999n, 1_000_000n, 1n)).toBe('exact');
    expect(compareSettlement(1_000_001n, 1_000_000n, 1n)).toBe('exact');
    // Just outside the band is still a mismatch.
    expect(compareSettlement(999_998n, 1_000_000n, 1n)).toBe('underpaid');
  });

  it('classifies a zero payment against a real expectation as underpaid', () => {
    expect(compareSettlement(0n, 1_000_000n)).toBe('underpaid');
  });
});
