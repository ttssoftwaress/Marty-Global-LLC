import { describe, expect, it } from 'vitest';

import { authRateLimitTiers } from './auth-rate-limit.js';

const {
  CREDENTIAL_PATHS,
  DISPATCH_PATHS,
  SESSION_PATHS,
  authPath,
  matches,
} = authRateLimitTiers;

// The limiter tiers dispatch on the path alone (it must not read the body, or
// Better Auth loses the raw stream), so the routing table is the thing worth
// testing — a path landing in the wrong tier is a silently weakened limit.
function tier(path: string): 'dispatch' | 'credentials' | 'session' | 'default' {
  const p = authPath({ path } as never);
  if (matches(p, DISPATCH_PATHS)) return 'dispatch';
  if (matches(p, CREDENTIAL_PATHS)) return 'credentials';
  if (matches(p, SESSION_PATHS)) return 'session';
  return 'default';
}

describe('auth rate-limit tiers', () => {
  it('puts credential attempts in the tight bucket', () => {
    expect(tier('/sign-in/email')).toBe('credentials');
    expect(tier('/sign-up/email')).toBe('credentials');
    expect(tier('/reset-password')).toBe('credentials');
    expect(tier('/change-password')).toBe('credentials');
  });

  it('puts email and SMS dispatch in the tightest bucket', () => {
    expect(tier('/forget-password')).toBe('dispatch');
    expect(tier('/send-verification-email')).toBe('dispatch');
    expect(tier('/verify-email')).toBe('dispatch');
  });

  it('puts session reads in the generous bucket', () => {
    expect(tier('/get-session')).toBe('session');
  });

  it('falls back to the default bucket for everything else', () => {
    expect(tier('/sign-out')).toBe('default');
    expect(tier('/list-sessions')).toBe('default');
    expect(tier('/admin/list-users')).toBe('default');
  });

  it('matches nested plugin routes by prefix', () => {
    expect(tier('/two-factor/verify-totp')).toBe('credentials');
    expect(tier('/email-otp/verify-email')).toBe('credentials');
  });

  it('does not let a lookalike prefix fall into a tighter tier', () => {
    expect(tier('/sign-in-with-nothing')).toBe('default');
  });

  it('is case-insensitive so a cased path cannot dodge a limit', () => {
    expect(tier('/Sign-In/Email')).toBe('credentials');
  });

  it('strips the mount prefix when given a full path', () => {
    expect(authPath({ path: '/api/auth/sign-in/email' } as never)).toBe(
      '/sign-in/email',
    );
  });
});
