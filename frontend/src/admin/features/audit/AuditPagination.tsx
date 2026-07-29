import { ListLoadMore, ListPagination } from '../../components/ListPagination';

/*
 * The audit log footer — the shared admin pager (`ListPagination`) with this
 * screen's copy.
 *
 * The page-number windowing the shared pager does matters more here than
 * anywhere else: an audit trail runs to hundreds of pages, so this is the screen
 * the window actually exists for.
 */

type AuditLoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function AuditLoadMore(props: AuditLoadMoreProps) {
  return <ListLoadMore label="Load more entries" {...props} />;
}

type AuditPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
};

export function AuditPagination(props: AuditPaginationProps) {
  return (
    <ListPagination {...props} noun="entries" ariaLabel="Audit log pagination" />
  );
}
