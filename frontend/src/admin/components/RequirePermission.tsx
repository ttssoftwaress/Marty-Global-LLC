import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

import { useAdminMe } from '@/admin/queries/admin-me';
import type { ReactNode } from 'react';
import { AdminLayout } from './AdminLayout';
import { useAdminShell } from '../hooks/useAdminShell';

/*
 * Per-area guard for an `/admin/*` screen, the companion to the sidebar's
 * filtering: the nav hides a section a member may not open, this handles the
 * ways they can still arrive at one — a bookmark, a deep link in an email, a
 * pasted URL, or a grant revoked while they had the tab open.
 *
 * Without it those routes render their real page, every query 403s, and the
 * member reads a screen of failed panels as "the portal is broken" rather than
 * "this is not mine to open".
 *
 * Convenience only. `requirePermission` on the backend is the boundary
 * (AGENTS.md, Auth) — this guard hides no data the server would have released,
 * it only explains a refusal the server is already making.
 */

export function RequirePermission({
  area,
  title,
  children,
}: {
  area: string;
  title: string;
  children: ReactNode;
}) {
  const me = useAdminMe();

  // Nothing is rendered until the record lands: showing the page first and
  // pulling it back would flash a screen the member cannot open, and showing the
  // denial first would flash a refusal at someone who has access.
  if (me.isPending) return null;

  // A failed fetch is not a denial. Rendering the page lets its own queries run
  // and report the real problem — a network error reads as one, and a genuine
  // 403 still comes back from the endpoints themselves.
  if (me.isError || me.data?.permissions.includes(area)) return <>{children}</>;

  return <AdminPermissionDenied title={title} />;
}

function AdminPermissionDenied({ title }: { title: string }) {
  const { user, onLogout } = useAdminShell();

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
          <h1 className="text-h5 font-semibold text-text lg:text-h4">{title}</h1>

          <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-[24px] bg-primary-light">
              <ShieldOff className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
            </span>

            <p className="text-body-lg font-semibold text-text">
              You don't have access to this section
            </p>
            <p className="max-w-[420px] text-body text-gray-500">
              Your account doesn't include {title.toLowerCase()}. An admin can
              grant it from Team &amp; staff.
            </p>

            <Link
              to="/admin"
              className="mt-2 rounded-input bg-primary px-5 py-3 text-body font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
