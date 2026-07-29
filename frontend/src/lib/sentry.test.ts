import { describe, expect, it } from 'vitest'

import { __testing } from './sentry'

const { scrub, scrubUrl, isSensitiveKey } = __testing

/*
 * The browser half of the PII scrubbing (AGENTS.md, Security & PII). Pinned for
 * the same reason as the backend's: a regression is silent — events keep
 * flowing, just with a customer's data in them.
 *
 * These rules are a hand-maintained mirror of backend/src/config/sentry.ts,
 * because the two apps share no code. Keep both test files in step.
 */

describe('isSensitiveKey', () => {
  it('matches regardless of case or surrounding words', () => {
    expect(isSensitiveKey('password')).toBe(true)
    expect(isSensitiveKey('confirmPassword')).toBe(true)
    expect(isSensitiveKey('TAX_ID')).toBe(true)
    expect(isSensitiveKey('billingAddress')).toBe(true)
  })

  it('leaves the identifiers we actually debug with alone', () => {
    for (const key of ['orderId', 'status', 'createdAt', 'serviceSlug']) {
      expect(isSensitiveKey(key)).toBe(false)
    }
  })
})

describe('scrub', () => {
  it('redacts sensitive values at any depth while keeping ids', () => {
    const result = scrub({
      orderId: 'ord_123',
      customer: {
        email: 'someone@example.com',
        taxId: '12-3456789',
        address: { street: '1 Main St' },
      },
    }) as { orderId: string; customer: Record<string, unknown> }

    expect(result.orderId).toBe('ord_123')
    expect(result.customer.email).toBe('[redacted]')
    expect(result.customer.taxId).toBe('[redacted]')
    expect(result.customer.address).toBe('[redacted]')
  })

  it('survives a cycle instead of hanging the error path', () => {
    const cyclic: Record<string, unknown> = { orderId: 'ord_1' }
    cyclic.self = cyclic

    expect(() => scrub(cyclic)).not.toThrow()
    expect((scrub(cyclic) as Record<string, unknown>).self).toBe('[circular]')
  })
})

describe('scrubUrl', () => {
  it('drops the query string, which is where a presigned R2 link lives', () => {
    expect(
      scrubUrl('https://api.example.com/v1/mailroom/room_1/item_2?sig=secret'),
    ).toBe('https://api.example.com/v1/mailroom/room_1/item_2')
  })

  it('keeps the path so the broken route is still identifiable', () => {
    expect(scrubUrl('https://app.example.com/app/billing')).toBe(
      'https://app.example.com/app/billing',
    )
  })

  /*
   * A relative URL still resolves against the page origin, so it takes the same
   * path — the point being that the query is stripped either way, which is the
   * property that actually matters here.
   */
  it('strips the query from a relative URL too', () => {
    expect(scrubUrl('/app/mailroom/room_1?sig=secret')).toBe(
      'http://localhost/app/mailroom/room_1',
    )
  })
})
