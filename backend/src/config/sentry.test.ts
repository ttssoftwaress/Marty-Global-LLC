import { describe, expect, it } from 'vitest';

import { __testing } from './sentry.js';

const { scrub, scrubRequest, isSensitiveKey } = __testing;

/*
 * These tests guard a security boundary, not a feature: `beforeSend` is the last
 * thing standing between a customer's tax ID and a third-party vendor's search
 * index. A regression here is silent — events keep flowing, just with PII in
 * them — so the redaction rules are pinned rather than trusted by inspection
 * (AGENTS.md, Security & PII).
 */

describe('isSensitiveKey', () => {
  it('matches regardless of case or surrounding words', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('confirmPassword')).toBe(true);
    expect(isSensitiveKey('TAX_ID')).toBe(true);
    expect(isSensitiveKey('billingAddress')).toBe(true);
  });

  it('leaves the identifiers we actually debug with alone', () => {
    for (const key of ['orderId', 'status', 'createdAt', 'serviceSlug']) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });
});

describe('scrub', () => {
  it('redacts sensitive values at any depth while keeping ids', () => {
    const result = scrub({
      orderId: 'ord_123',
      customer: {
        email: 'someone@example.com',
        taxId: '12-3456789',
        address: { street: '1 Main St', postcode: 'SW1A 1AA' },
      },
    }) as { orderId: string; customer: Record<string, unknown> };

    expect(result.orderId).toBe('ord_123');
    expect(result.customer.email).toBe('[redacted]');
    expect(result.customer.taxId).toBe('[redacted]');
    // The whole address subtree goes, not just its leaves.
    expect(result.customer.address).toBe('[redacted]');
  });

  it('survives a cycle instead of hanging the error path', () => {
    const cyclic: Record<string, unknown> = { orderId: 'ord_1' };
    cyclic.self = cyclic;

    expect(() => scrub(cyclic)).not.toThrow();
    expect((scrub(cyclic) as Record<string, unknown>).self).toBe('[circular]');
  });

  it('stops descending past the depth bound', () => {
    // 8 levels deep — past the limit of 6, so the tail is returned untouched
    // rather than walked forever.
    const deep = { a: { b: { c: { d: { e: { f: { g: { password: 'x' } } } } } } } };
    expect(() => scrub(deep)).not.toThrow();
  });
});

describe('scrubRequest', () => {
  it('drops the body, cookies, credentialed headers, and the query string', () => {
    const request = {
      url: 'https://api.example.com/v1/orders/ord_1?token=presigned-secret',
      method: 'POST',
      headers: {
        authorization: 'Bearer abc',
        cookie: 'session=xyz',
        'content-type': 'application/json',
      },
      cookies: { session: 'xyz' },
      data: { taxId: '12-3456789' },
      query_string: 'token=presigned-secret&status=PAID',
    };

    scrubRequest(request);

    expect(request.data).toBe('[redacted]');
    expect(request.headers.authorization).toBe('[redacted]');
    expect(request.headers.cookie).toBe('[redacted]');
    // Not everything is redacted — the fields that make an error debuggable stay.
    expect(request.headers['content-type']).toBe('application/json');
    expect(request.cookies).toEqual({ '[redacted]': '[redacted]' });
    expect(request.method).toBe('POST');

    // A presigned URL grants read access to a private document for its whole
    // TTL, so it must not survive in either the URL or the query string.
    expect(request.url).toBe('https://api.example.com/v1/orders/ord_1');
    expect(request.query_string).toContain('token=%5Bredacted%5D');
    expect(request.query_string).toContain('status=PAID');
  });
});
