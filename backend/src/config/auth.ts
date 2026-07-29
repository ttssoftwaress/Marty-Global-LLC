import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { auditAuthHook } from '../modules/audit/audit.auth-hook.js';
import { queueEmail } from '../modules/notifications/notifications.service.js';
import { env } from './env.js';

// Better Auth owns all session and password handling (AGENTS.md "Auth"). We only
// configure it here — the handler is mounted in app.ts and the backend guards
// derive from it. Roles come from the admin plugin: customer, staff, admin.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...env.FRONTEND_ORIGIN],

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  // Persistent login with a 7-day sliding window. A session lives up to 7 days
  // (`expiresIn`); every visit at least a day after the last refresh pushes
  // `expiresAt` back out to a fresh 7 days (`updateAge`), so the clock only runs
  // during inactivity — 7 straight days unused expires the session and logs the
  // user out. The sliding refresh only applies when the login was "Remember Me"
  // (a persistent cookie); a session-only login is not extended.
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // extend at most once per day of activity
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
    autoSignIn: false,

    // Password reset. Better Auth mints the token and hands us the ready-built
    // link (the frontend's /reset-password/new screen with ?token=…); we queue
    // the email through the notifications pipeline like every other outbound
    // message (AGENTS.md "Security & PII" — never send inline). AWS credentials
    // aren't set yet, so the SES transport skips the actual send; we also log the
    // link to the backend console so the flow is testable end-to-end without SES.
    sendResetPassword: async ({ user, url }) => {
      logger.info(
        { userId: user.id, resetUrl: url },
        'Password reset link (SES not configured — copy this link to continue)',
      );

      await queueEmail({
        to: user.email,
        subject: 'Reset your Marty Global password',
        template: 'generic',
        heading: 'Reset your password',
        body: 'We received a request to reset the password for your Marty Global account. Click the button below to choose a new password. This link expires in 1 hour. If you didn\'t request this, you can safely ignore this email.',
        actionLabel: 'Reset Password',
        actionUrl: url,
        userId: user.id,
      });
    },
  },

  user: {
    additionalFields: {
      // Country / region of incorporation, captured at signup for later use in
      // filing jurisdiction. Optional so admin-created users aren't forced to set it.
      country: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },

  /*
   * The audit trail for authentication (modules/audit/audit.auth-hook.ts).
   *
   * Better Auth owns this whole subtree, so there is no service of ours to put a
   * `record` call in — this hook is that layer. It runs after every auth
   * endpoint, including the ones that threw, which is what makes a failed
   * sign-in auditable. It never modifies the response and never throws.
   */
  hooks: {
    after: auditAuthHook,
  },

  plugins: [
    admin({
      defaultRole: 'customer',
      adminRoles: ['admin'],
    }),
  ],
});

export type Auth = typeof auth;
