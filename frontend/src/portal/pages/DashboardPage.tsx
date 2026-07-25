import { PortalLayout } from '../components/PortalLayout';
import {
  BillingSummaryCard,
  KpiCards,
  MailRoomsCard,
  QuickActions,
  RecentActivity,
  RecentOrders,
  WelcomeBanner,
  useDashboardSummary,
} from '../features/dashboard';
import { firstNameOf, usePortalShell } from '../hooks/usePortalShell';
import type { DashboardSummary } from '../types/dashboard';

/*
 * Portal dashboard — the customer's home screen.
 *
 * Desktop splits the body into a two-column grid: orders and quick actions on
 * the left, activity/billing/mail rooms in a 380px right rail. Tablet and
 * mobile collapse to one column and reorder — orders, quick actions, activity,
 * then the two summary cards — so both trees are rendered and swapped at `lg`
 * rather than forcing one grid to reflow into a different reading order.
 *
 * Every value comes from `summary`; nothing on this page is hardcoded customer
 * data. It loads from `GET /v1/dashboard/summary`, which the backend composes
 * from the orders, billing, mail-room, and support modules so each figure agrees
 * with the page it links to. A skeleton renders until that query resolves.
 *
 * The props are an override for rendering the page with a supplied summary
 * (stories/tests); the route passes none and the query supplies it.
 */

type DashboardPageProps = {
  summary?: DashboardSummary;
  isLoading?: boolean;
};

function DashboardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5 md:gap-6 lg:gap-8" aria-hidden="true">
      <div className="h-[104px] w-full animate-pulse rounded-card bg-gray-200" />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[112px] animate-pulse rounded-card bg-gray-200"
          />
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="h-[360px] min-w-0 flex-1 animate-pulse rounded-card bg-gray-200" />
        <div className="h-[360px] animate-pulse rounded-card bg-gray-200 lg:w-[380px]" />
      </div>
    </div>
  );
}

export function DashboardPage(props: DashboardPageProps = {}) {
  // The shell's name and role come from the auth session; the summary supplies
  // the page's customer data.
  const { user, onLogout } = usePortalShell();
  const query = useDashboardSummary();

  // A supplied summary wins over the query, so the page can be rendered with
  // fixture data without the network.
  const summary = props.summary ?? query.data;
  const isLoading = props.summary ? Boolean(props.isLoading) : query.isPending;

  // The banner falls back to the first name on the account, so the greeting is
  // never empty while the summary is still loading.
  const firstName = summary?.customerFirstName ?? firstNameOf(user.name);

  return (
    <PortalLayout
      user={user}
      notificationCount={summary?.metrics.unreadMail}
      onLogout={onLogout}
    >
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 md:gap-6 lg:gap-8">
          {isLoading || !summary ? (
            <DashboardSkeleton />
          ) : (
            <>
              <WelcomeBanner
                firstName={firstName}
                accountStatus={summary.accountStatus}
                unreadMail={summary.metrics.unreadMail}
                pendingQuotes={summary.billing.pendingQuotes}
              />

              <KpiCards metrics={summary.metrics} />

              {/*
               * The section order is the same at every width, so one tree
               * covers all three. Below `lg` the outer element is a plain
               * column and the two inner groups add no layout of their own;
               * at `lg` it becomes a row and they resolve into a content
               * column and a 380px rail. Grouping (rather than a grid with
               * explicit row placement) keeps each column's cards packed
               * against each other instead of aligning to shared row lines.
               */}
              <div className="flex w-full flex-col gap-5 md:gap-6 lg:flex-row lg:items-start lg:gap-6">
                <div className="flex flex-col gap-5 md:gap-6 lg:min-w-0 lg:flex-1">
                  <RecentOrders orders={summary.recentOrders} />
                  <QuickActions />
                </div>

                <div className="flex flex-col gap-5 md:gap-6 lg:w-[380px] lg:shrink-0">
                  <RecentActivity activity={summary.recentActivity} />
                  <BillingSummaryCard billing={summary.billing} />
                  <MailRoomsCard mailRooms={summary.mailRooms} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
