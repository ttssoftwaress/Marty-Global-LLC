import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { signOut, useSession } from '@/auth/client';
import { clearSessionHint } from '@/lib/session-hint';
import { closeSocket } from '@/services/socket';
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

export function useAdminShell(): {
  user: AdminSidebarUser;
  // The signed-in agent's id. The support thread needs it to decide which
  // replies are the reader's own — the same message is this agent's on one desk
  // and a colleague's on another, so it cannot come off the wire resolved.
  userId: string | undefined;
  onLogout: () => void;
} {
  const { data: session } = useSession();
  const navigate = useNavigate();

  // Same contract as the portal shell: Better Auth resolves with `{ error }`
  // instead of throwing, so `onSuccess` is what tells us the session really
  // ended. `finally` would send a still-signed-in admin to /login on a failure.
  const onLogout = useCallback(() => {
    void signOut({
      fetchOptions: {
        onSuccess: () => {
          // The socket authenticates from the session cookie, so a live one left
          // open after sign-out would keep delivering this agent's messages to a
          // browser that is back on the login screen.
          closeSocket();
          // The session is gone, so the public routes must stop holding their
          // render for it (see lib/session-hint.ts).
          clearSessionHint();
          navigate(LOGIN_ROUTE, { replace: true });
        },
      },
    }).catch(() => {
      // Transport failure: stay put rather than stranding a live session.
    });
  }, [navigate]);

  return {
    user: {
      name: session?.user.name ?? '',
      role: roleLabel(session?.user.role),
      // Stands in until `/admin/me` lands, which the layout prefers over this —
      // the record is what an edit writes to, the session copy refreshes on its
      // own schedule.
      email: session?.user.email,
    },
    userId: session?.user.id,
    onLogout,
  };
}
