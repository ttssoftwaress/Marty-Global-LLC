import type { Request } from 'express';

import { AppError } from '../lib/app-error.js';
import type { Role } from '../lib/roles.js';

// What the guards resolve from a Better Auth session and hand to controllers and
// services. Deliberately narrow — guards pass identity, not the whole user row;
// anything else a service needs it reads from Prisma itself.
export interface AuthContext {
  userId: string;
  role: Role;
  sessionId: string;
  email: string;
  emailVerified: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set by requireAuth / optionalAuth. Undefined on public routes.
      auth?: AuthContext;
    }
  }
}

// Guarded handlers read the context through this instead of `req.auth!`, so a
// route that forgets its guard fails loudly server-side rather than silently
// treating the request as anonymous.
export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw AppError.unauthenticated();
  }
  return req.auth;
}
