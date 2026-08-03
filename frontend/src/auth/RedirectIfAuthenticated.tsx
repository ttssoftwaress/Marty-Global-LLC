import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useSession } from '@/auth/client';
import { landingRouteFor } from '@/auth/landing';
import { clearSessionHint, hasSessionHint, markSessionHint } from '@/lib/session-hint';

// Keeps a logged-in visitor out of the logged-out surfaces — the auth screens
// AND the marketing site. A persistent "Remember Me" cookie carries the session
// across visits (7-day sliding window, see backend/src/config/auth.ts), so
// anyone who still has a valid session is sent to the landing screen for their
// role instead of the public pages. The backend session is the real gate; this
// is convenience routing (AGENTS.md "Auth").
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  // Keep the device hint honest. A session that expired, or that was ended in
  // another tab, must stop holding the public pages blank on the next visit —
  // and a fresh one must start doing so even if the sign-in happened elsewhere.
  useEffect(() => {
    if (isPending) return;
    if (session) markSessionHint();
    else clearSessionHint();
  }, [isPending, session]);

  /*
   * While the session check is in flight we have to guess. On a device that
   * last held a session, hold the render so the auth screen or marketing page
   * never flashes before the redirect. On every other device — the common case
   * on marketing — render immediately rather than blanking the public site for
   * a round trip that will come back empty.
   */
  if (isPending) return hasSessionHint() ? null : <>{children}</>;

  if (session) return <Navigate to={landingRouteFor(session.user.role)} replace />;

  return <>{children}</>;
}
