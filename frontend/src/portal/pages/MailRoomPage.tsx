import { Link } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  MailRoomError,
  MailRoomKpiCards,
  MailRoomSection,
  useMailRoomOverview,
} from '../features/mailroom';
import { usePortalShell } from '../hooks/usePortalShell';

/*
 * Virtual mail rooms — the customer's scanned-mail surface: the headline figures
 * (rooms, unread, pending) and the grid of rooms, each opening to its inbox.
 *
 * One tree serves all three viewports; the section components own how each part
 * reshapes between breakpoints (KPI 2-up ⇄ 3-up, room cards restacking, the
 * Add-room button lifting above the heading on mobile). The header block is the
 * only page-level piece here.
 *
 * Nothing is hardcoded customer data: the overview comes from the backend
 * (endpoint lands later, AGENTS.md two-apps sync), so the screen renders a
 * skeleton until it arrives and an empty state once it does with no rooms.
 */

function MailRoomHeader() {
  return (
    <header className="flex w-full flex-col gap-1 md:gap-3">
      <p className="flex items-center gap-1.5 text-caption font-medium uppercase tracking-[0.6px]">
        <Link to="/app" className="text-primary hover:underline">
          Dashboard
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">Virtual mail rooms</span>
      </p>

      {/* Title + subtitle are one group in the design (0.375rem apart), set apart
       * from the breadcrumb above (0.75rem on tablet/desktop, 4px flat on mobile). */}
      <div className="flex flex-col gap-1 md:gap-1.5">
        <h1 className="text-h4 font-semibold text-text md:text-h3">Virtual mail rooms</h1>
        <p className="text-body text-text-secondary">
          Manage your mail rooms, view scanned mail, and request forwarding.
        </p>
      </div>
    </header>
  );
}

function MailRoomSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="col-span-2 h-24 animate-pulse rounded-card bg-gray-200 md:col-span-1" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        <div className="h-52 animate-pulse rounded-card bg-gray-200" />
        <div className="h-52 animate-pulse rounded-card bg-gray-200" />
        <div className="h-52 animate-pulse rounded-card bg-gray-200" />
      </div>
    </div>
  );
}

export function MailRoomPage() {
  const { user, onLogout } = usePortalShell();
  const overview = useMailRoomOverview();

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 lg:gap-8">
          <MailRoomHeader />

          {overview.isLoading ? (
            <MailRoomSkeleton />
          ) : overview.isError || !overview.data ? (
            <MailRoomError onRetry={() => void overview.refetch()} />
          ) : (
            <>
              <MailRoomKpiCards stats={overview.data.stats} />
              <MailRoomSection rooms={overview.data.rooms} />
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
