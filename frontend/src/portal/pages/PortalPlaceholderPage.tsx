import { Construction } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import { usePortalShell } from '../hooks/usePortalShell';

/*
 * Stand-in for the portal sections the sidebar links to whose screens are not
 * built yet. It renders the real shell — sidebar, top bar, session — so the nav
 * stays usable and a stray link never drops the customer back onto marketing.
 * Delete each usage as its screen lands.
 */

export function PortalPlaceholderPage({ title }: { title: string }) {
  const { user, onLogout } = usePortalShell();

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
          <h1 className="text-h5 font-semibold text-text lg:text-h4">{title}</h1>

          <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-[24px] bg-primary-light">
              <Construction className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
            </span>

            <p className="text-body-lg font-semibold text-text">Coming soon</p>
            <p className="max-w-[420px] text-body text-gray-500">
              This section is being built. Everything else in your portal is
              ready to use.
            </p>

            <Link
              to="/app"
              className="btn btn-primary mt-2 h-11 rounded-input px-6 text-body"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
