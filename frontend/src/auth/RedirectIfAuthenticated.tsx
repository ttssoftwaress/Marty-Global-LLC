import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useSession } from '@/auth/client';

// The portal dashboard is every signed-in customer's landing screen.
const DEFAULT_AUTHENTICATED_ROUTE = '/app';

// Keeps a logged-in visitor out of the auth screens. A persistent "Remember Me"
// cookie carries the session across visits (7-day sliding window, see
// backend/src/config/auth.ts), so anyone who still has a valid session is sent
// to their default landing instead of the login/signup pages. The backend
// session is the real gate; this is convenience routing (AGENTS.md "Auth").
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  // Wait for the session check so we don't flash the auth page then redirect.
  if (isPending) return null;

  if (session) return <Navigate to={DEFAULT_AUTHENTICATED_ROUTE} replace />;

  return <>{children}</>;
}
