// Backend guards — the real authorization boundary (AGENTS.md "Auth").
// Frontend route guards are convenience only; nothing is trusted from the client.
//
// Route composition order:
//   router.use(requireAuth)                       // 401 if no session
//   router.post('/', requireStaff, apiRateLimit, controller.create)
//
// Ownership is checked in the service layer, after the record is loaded.

export type { AuthContext } from './auth-context.js';
export { getAuth } from './auth-context.js';

export { optionalAuth, requireAuth } from './require-auth.js';
export {
  requireAdmin,
  requireCustomer,
  requireRole,
  requireStaff,
} from './require-role.js';
export { requireVerifiedEmail } from './require-verified-email.js';
export { requireIdempotencyKey } from './require-idempotency-key.js';

export {
  assertCanMutate,
  assertFound,
  assertOwner,
  canAccess,
  isStaff,
} from './ownership.js';

export {
  apiRateLimit,
  chatRateLimit,
  publicRateLimit,
  sensitiveRateLimit,
} from './rate-limit.js';

export { betterAuthRateLimit } from './auth-rate-limit.js';

export { authenticateSocket, socketHasRole } from './socket-auth.js';
