import { ListLoadMore, ListPagination } from '../../components/ListPagination';

/*
 * The team list footer — the shared admin pager (`ListPagination`) with this
 * screen's copy.
 *
 * The mobile link ends the card stack with no footer at all, which leaves
 * anything past the first page unreachable on a phone, so "Load more team
 * members" is added there (Design.md, filling in a gap; logged as a deviation).
 */

type TeamLoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function TeamLoadMore(props: TeamLoadMoreProps) {
  return <ListLoadMore label="Load more team members" {...props} />;
}

type TeamPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
};

export function TeamPagination(props: TeamPaginationProps) {
  return (
    <ListPagination {...props} noun="results" ariaLabel="Team pagination" />
  );
}
