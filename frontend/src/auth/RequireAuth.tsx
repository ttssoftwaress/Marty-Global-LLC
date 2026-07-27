import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '@/auth/client';
import { landingRouteFor, PORTAL_ROUTE } from '@/auth/landing';

const LOGIN_ROUTE = '/login';

// Route guard for the customer portal (`/app/*`). A visitor without a live
// session is sent to log in, carrying the path they asked for in location state
// so the login page can return them there. This is convenience routing only —
// the backend session is the real boundary (AGENTS.md "Auth").
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  // Wait for the session check so a logged-in visitor never flashes the login
  // page on a hard refresh inside the portal.
  if (isPending) return null;

  if (!session) {
    return <Navigate to={LOGIN_ROUTE} replace state={{ from: location.pathname }} />;
  }

  // The portal is the customer's area. Staff and admin belong in the admin
  // portal, so a hand-typed `/app` sends them there rather than rendering the
  // customer shell around a staff session.
  const landing = landingRouteFor(session.user.role);
  if (landing !== PORTAL_ROUTE) return <Navigate to={landing} replace />;

  return <>{children}</>;
}
