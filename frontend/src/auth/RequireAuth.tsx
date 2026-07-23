import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '@/auth/client';

const LOGIN_ROUTE = '/login';

// Route guard for the authenticated areas (`/app/*`). A visitor without a live
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

  return <>{children}</>;
}
