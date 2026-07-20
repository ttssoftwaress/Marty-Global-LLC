import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';

import { prisma } from '../lib/prisma.js';
import { env } from './env.js';

// Better Auth owns all session and password handling (AGENTS.md "Auth"). We only
// configure it here — the handler is mounted in app.ts and the backend guards
// derive from it. Roles come from the admin plugin: customer, staff, admin.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_ORIGIN],

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
    // Registration only for now — email verification and password reset land
    // with the login work.
    requireEmailVerification: false,
    autoSignIn: false,
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

  plugins: [
    admin({
      defaultRole: 'customer',
      adminRoles: ['admin'],
    }),
  ],
});

export type Auth = typeof auth;
