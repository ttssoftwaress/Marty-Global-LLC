import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  BillingKpiCards,
  PaymentHistory,
  QuotesAwaitingPayment,
  SavedPaymentMethods,
  useBillingOverview,
  usePaymentHistory,
} from '../features/billing';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePortalShell } from '../hooks/usePortalShell';
import type { PaymentHistoryRange } from '../types/billing';

/*
 * Billing & payments — the customer's money surface: what's owed (KPIs +
 * quotes), what's been paid (history), and the cards on file.
 *
 * One tree serves all three viewports; the section components own how each part
 * reshapes between breakpoints (tables ⇄ cards, rows ⇄ grids). The header block
 * is the only page-level responsive piece — a breadcrumb from tablet up, a
 * "Back to Dashboard" link on mobile — so it lives here.
 *
 * Nothing is hardcoded customer data: the overview and history both come from
 * the backend (endpoints land later), so the screen renders a skeleton until an
 * overview arrives. Payment history is an infinite query so the design's two
 * pagination shapes work over one cursor stream (AGENTS.md, cursor pagination).
 */

// Mirrors the backend page size for the payment-history window.
const PAGE_SIZE = 10;

function BillingHeader() {
  return (
    <header className="flex w-full flex-col gap-2">
      {/* Mobile back link */}
      <Link
        to="/app"
        className="flex items-center gap-2 text-body font-medium text-primary md:hidden"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Back to Dashboard
      </Link>

      {/* Breadcrumb — tablet & desktop */}
      <p className="hidden items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.6px] md:flex">
        <Link to="/app" className="text-primary hover:underline">
          Dashboard
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">Billing &amp; payments</span>
      </p>

      <h1 className="text-h4 font-bold text-text md:text-h3 md:font-semibold">
        Billing &amp; payments
      </h1>
      <p className="text-[13px] text-text-secondary md:text-body md:text-gray-500">
        View your quotes, make payments, and access your invoice history.
      </p>
    </header>
  );
}

function BillingSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 md:gap-7 lg:gap-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="col-span-2 h-24 animate-pulse rounded-card bg-gray-200 md:col-span-1" />
      </div>
      <div className="h-64 w-full animate-pulse rounded-card bg-gray-200" />
      <div className="h-96 w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

export function BillingPage() {
  const { user, onLogout } = usePortalShell();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [range, setRange] = useState<PaymentHistoryRange>('12m');

  const overview = useBillingOverview();
  const history = usePaymentHistory({ search: debouncedSearch, range });

  // Desktop page window into the loaded history. Reset to the first page
  // whenever the range or search changes, since the result set is different.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, range]);

  const loadedPayments = useMemo(
    () => history.data?.pages.flatMap((page) => page.payments) ?? [],
    [history.data],
  );

  const totalPages = history.data?.pages[0]?.totalPages ?? 1;

  const goPrev = () => setPageIndex((index) => Math.max(0, index - 1));
  const goNext = () => {
    const nextIndex = pageIndex + 1;
    // If the next window isn't loaded yet but more remain on the server, fetch it.
    if (nextIndex * PAGE_SIZE >= loadedPayments.length && history.hasNextPage) {
      void history.fetchNextPage();
    }
    if (nextIndex < totalPages) setPageIndex(nextIndex);
  };
  const onLoadMore = () => {
    if (history.hasNextPage) void history.fetchNextPage();
  };

  const showSkeleton = overview.isLoading || !overview.data;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 md:gap-7 lg:gap-8">
          <BillingHeader />

          {showSkeleton ? (
            <BillingSkeleton />
          ) : (
            <>
              <BillingKpiCards kpis={overview.data.kpis} />

              <QuotesAwaitingPayment quotes={overview.data.quotes} />

              <PaymentHistory
                search={search}
                onSearchChange={setSearch}
                range={range}
                onRangeChange={setRange}
                payments={loadedPayments}
                page={pageIndex + 1}
                pageSize={PAGE_SIZE}
                totalPages={totalPages}
                isLoading={history.isLoading}
                canLoadMore={Boolean(history.hasNextPage)}
                onLoadMore={onLoadMore}
                onPrev={goPrev}
                onNext={goNext}
              />

              <SavedPaymentMethods methods={overview.data.savedMethods} />
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
