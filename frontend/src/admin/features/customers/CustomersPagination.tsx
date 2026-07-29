import { ListLoadMore, ListPagination } from '../../components/ListPagination';

/*
 * The customers list footer — the shared admin pager (`ListPagination`) with
 * this screen's copy and its design's square page buttons.
 *
 * The links place the two presentations differently, which is why they stay two
 * exports: the pager is a row under the table card, while "Load more" sits under
 * the mobile card stack with its own top spacing.
 */

type CustomersLoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function CustomersLoadMore(props: CustomersLoadMoreProps) {
  return <ListLoadMore label="Load more customers" className="pt-6" {...props} />;
}

type CustomersPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
};

export function CustomersPagination(props: CustomersPaginationProps) {
  return (
    <ListPagination
      {...props}
      noun="customers"
      ariaLabel="Customers pagination"
      variant="square"
    />
  );
}
