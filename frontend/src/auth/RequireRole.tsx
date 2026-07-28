import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '@/auth/client';
import { landingRouteFor } from '@/auth/landing';
import { isRole, type Role } from '@/constants/roles';

const LOGIN_ROUTE = '/login';

// Role guard for the staff areas (`/admin/*`). It authorizes, it does not
// authenticate: no session at all is a trip to /login (carrying the requested
// path, same as RequireAuth), while a live session with the wrong role is sent
// back to the customer portal rather than the login screen — logging in again
// would not grant the role. Convenience routing only; the backend guards in
// backend/src/guards/require-role.ts are the real boundary (AGENTS.md "Auth").
export function RequireRole({
  allowed,
  children,
}: {
  allowed: readonly Role[];
  children: ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  // Wait for the session check so a signed-in admin never flashes a redirect on
  // a hard refresh inside `/admin`.
  if (isPending) return null;

  if (!session) {
    // Carry search and hash too — a deep link into /admin is rarely just a path,
    // and returnPathFor() still rejects anything outside the role's area.
    return (
      <Navigate
        to={LOGIN_ROUTE}
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  const { role } = session.user;
  if (!isRole(role) || !allowed.includes(role)) {
    return <Navigate to={landingRouteFor(role)} replace />;
  }

  return <>{children}</>;
}
