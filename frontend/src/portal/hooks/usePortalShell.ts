import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { signOut, useSession } from '@/auth/client';
import { closeSocket } from '@/services/socket';
import type { SidebarUser } from '@/portal/components/sidebar';
// Imported from the query module rather than the feature barrel so the shell —
// which every portal page mounts — doesn't pull in the settings cards too.
import { useProfile } from '@/portal/features/settings/queries';

/*
 * Shell wiring shared by every `/app/*` screen: who is signed in, and how they
 * sign out. The session is already fetched by the route guard, so reading it
 * here is a cache hit rather than a second request.
 *
 * `role` is the label the sidebar prints under the name. Better Auth types it
 * as an optional string (the admin plugin's role field), so it falls back to
 * the customer label — the backend guards are the real role boundary.
 *
 * The avatar comes from the same `GET /v1/profile` query the settings screen
 * reads, deliberately rather than from the session: the served link is a
 * short-TTL presigned URL (AGENTS.md, Security & PII) and the session carries no
 * such thing. Sharing that one cache key is what keeps the picture consistent
 * everywhere — saving a new photo writes the refreshed profile into it, so the
 * sidebar and top bar repaint from that same write without a refetch.
 */

const LOGIN_ROUTE = '/login';
const DEFAULT_ROLE_LABEL = 'Customer';

function roleLabel(role: unknown): string {
  if (typeof role !== 'string' || !role) return DEFAULT_ROLE_LABEL;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function usePortalShell(): { user: SidebarUser; onLogout: () => void } {
  const { data: session } = useSession();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  /*
   * Navigate only once the session is actually gone. `finally` also runs on
   * rejection, which would drop a still-authenticated customer on /login with a
   * live session and leave the rejected promise unhandled. Better Auth resolves
   * with `{ error }` rather than throwing for a failed sign-out, so `onSuccess`
   * — not the promise — is the signal that the session ended.
   */
  const onLogout = useCallback(() => {
    void signOut({
      fetchOptions: {
        onSuccess: () => {
          // The socket authenticates from the session cookie, so one left open
          // after sign-out would keep delivering this customer's messages to a
          // browser that is back on the login screen.
          closeSocket();
          navigate(LOGIN_ROUTE, { replace: true });
        },
      },
    }).catch(() => {
      // Transport failure: stay on the page rather than stranding a live session
      // behind the login screen.
    });
  }, [navigate]);

  return {
    user: {
      // The profile record wins over the session for the name too: saving a new
      // one updates that record immediately, while the session copy only
      // refreshes on its own schedule.
      name: profile?.fullName || (session?.user.name ?? ''),
      role: roleLabel(session?.user.role),
      avatarUrl: profile?.avatarUrl,
    },
    onLogout,
  };
}

// The dashboard greets the customer by first name; the session carries the full
// name they signed up with.
export function firstNameOf(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}
