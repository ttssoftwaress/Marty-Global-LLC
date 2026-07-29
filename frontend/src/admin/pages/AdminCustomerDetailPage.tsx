import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { AdminLayout } from '../components/AdminLayout';
import {
  CustomerDetailBreadcrumbs,
  CustomerDetailHeader,
  CustomerDetailTabs,
  CustomerMetricCards,
  CustomerOrdersPanel,
  CustomerSectionPlaceholder,
  customerTabPanelId,
  useAdminCustomer,
  useAdminCustomerOrders,
} from '../features/customer-detail';
import { useAdminShell } from '../hooks/useAdminShell';
import type { CustomerDetailTab, CustomerOrderRow } from '../types/customer-detail';
import {
  CUSTOMER_DETAIL_TABS,
  DEFAULT_CUSTOMER_DETAIL_TAB,
  isCustomerDetailTab,
} from '../types/customer-detail';

/*
 * Customer detail — the staff screen for one customer account.
 *
 * The section order is the same at every width — trail, identity header, KPI
 * cards, tabs, then the active panel — so one tree covers all three links. What
 * changes is how each section draws itself, and each component owns its own
 * breakpoint behaviour rather than the page branching on width:
 *   - the trail becomes a single back control on mobile
 *   - the identity block moves into a white card on mobile, stacks on tablet,
 *     and becomes one row with the action pinned right on desktop
 *   - the KPI grid is 2×2 below `lg` and one row of four above it
 *   - the orders list is a table at `md` and up, cards on mobile
 *
 * Every figure and row comes from the API; nothing on this page is hardcoded
 * business data. Two queries back it (endpoints land later): the customer record
 * for the header and the KPI cards, and an infinite query for the orders.
 *
 * The active tab lives in `?tab=`, so a section deep-links, Back steps between
 * sections, and a refresh stays where the admin was. An unknown or absent value
 * falls back to Orders — the tab the links draw.
 *
 * Only the Orders panel is built; the other four render the placeholder in the
 * same frame, so no tab dead-ends on a blank page.
 */

const TAB_PARAM = 'tab';

function CustomerDetailSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5 md:gap-6" aria-hidden="true">
      <div className="h-14 w-full animate-pulse rounded-card bg-gray-200 md:h-16 lg:h-14" />

      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[5.5rem] animate-pulse rounded-card bg-gray-200 lg:h-[5.75rem]" />
        ))}
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-9 w-24 shrink-0 animate-pulse rounded-pill bg-gray-200 md:h-10" />
        ))}
      </div>

      {/* Mobile — a stack of cards. */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[9.25rem] animate-pulse rounded-card bg-gray-200" />
        ))}
      </div>

      {/* Tablet & desktop — the table frame. */}
      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-12 w-full border-b border-gray-200 bg-[var(--table-header-bg)]" />
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex h-16 items-center border-b border-gray-200 px-5 last:border-b-0 lg:h-table-row lg:px-card"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-card border border-gray-200 bg-white px-6 py-16 text-center">
      <p className="text-h6 text-text">Customer not found</p>
      <p className="max-w-[26.25rem] text-body text-gray-500">
        This account may have been removed, or the link is no longer valid.
      </p>
    </div>
  );
}

export function AdminCustomerDetailPage() {
  const { user, onLogout } = useAdminShell();
  const { customerId = '' } = useParams<{ customerId: string }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get(TAB_PARAM);
  const activeTab: CustomerDetailTab = isCustomerDetailTab(tabParam)
    ? tabParam
    : DEFAULT_CUSTOMER_DETAIL_TAB;

  const setActiveTab = (tab: CustomerDetailTab) => {
    const next = new URLSearchParams(searchParams);
    next.set(TAB_PARAM, tab);
    setSearchParams(next);
  };

  const customer = useAdminCustomer(customerId);

  const orders = useAdminCustomerOrders(customerId);
  const loadedOrders = useMemo<CustomerOrderRow[]>(
    () => orders.data?.pages.flatMap((page) => page.orders) ?? [],
    [orders.data],
  );
  const totalOrders = orders.data?.pages[0]?.totalResults ?? 0;

  const activeTabLabel =
    CUSTOMER_DETAIL_TABS.find((tab) => tab.value === activeTab)?.label ?? '';

  const isLoading = customer.isPending;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col gap-5 md:gap-6">
          <CustomerDetailBreadcrumbs customerName={customer.data?.name ?? ''} />

          {isLoading ? (
            <CustomerDetailSkeleton />
          ) : customer.data ? (
            <>
              <CustomerDetailHeader customer={customer.data} />

              <CustomerMetricCards metrics={customer.data.metrics} />

              <CustomerDetailTabs value={activeTab} onChange={setActiveTab} />

              <div
                role="tabpanel"
                id={customerTabPanelId(activeTab)}
                aria-label={activeTabLabel}
                className="w-full"
              >
                {activeTab === 'orders' ? (
                  orders.isPending ? (
                    <div
                      className="h-[20rem] w-full animate-pulse rounded-card bg-gray-200 md:rounded-table"
                      aria-hidden="true"
                    />
                  ) : (
                    <CustomerOrdersPanel
                      orders={loadedOrders}
                      totalResults={totalOrders}
                      hasMore={Boolean(orders.hasNextPage)}
                      isLoadingMore={orders.isFetchingNextPage}
                      onLoadMore={() => {
                        if (orders.hasNextPage) void orders.fetchNextPage();
                      }}
                    />
                  )
                ) : (
                  <CustomerSectionPlaceholder title={activeTabLabel} />
                )}
              </div>
            </>
          ) : (
            <NotFoundState />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
