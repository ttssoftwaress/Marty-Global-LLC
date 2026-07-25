import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { signOut, useSession } from '@/auth/client';
import type { AdminSidebarUser } from '@/admin/components/sidebar';

/*
 * Shell wiring shared by every `/admin/*` screen: who is signed in, and how they
 * sign out. The session is already fetched by the route guard, so reading it
 * here is a cache hit rather than a second request.
 *
 * `role` is the label the sidebar prints under the name. Better Auth types it as
 * an optional string (the admin plugin's role field), so it falls back to the
 * staff label — the backend guards are the real role boundary.
 *
 * Mirrors `usePortalShell`; the two areas never import from each other
 * (AGENTS.md, route-group rule), so each keeps its own copy.
 */

const LOGIN_ROUTE = '/login';
const DEFAULT_ROLE_LABEL = 'Staff';

function roleLabel(role: unknown): string {
  if (typeof role !== 'string' || !role) return DEFAULT_ROLE_LABEL;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function useAdminShell(): { user: AdminSidebarUser; onLogout: () => void } {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const onLogout = useCallback(() => {
    void signOut().finally(() => navigate(LOGIN_ROUTE, { replace: true }));
  }, [navigate]);

  return {
    user: {
      name: session?.user.name ?? '',
      role: roleLabel(session?.user.role),
    },
    onLogout,
  };
}
