import { useCallback, useEffect, useMemo, useState } from 'react';

/*
 * The numbered pager the admin's cursor-backed lists step over their loaded
 * rows (AGENTS.md — lists are `?cursor=` in, `{ data, nextCursor }` out).
 *
 * The API pages by cursor, but every one of these designs draws an absolute
 * range ("Showing 21–30 of 1,482") and a jumpable page strip, which a cursor
 * alone cannot produce. The endpoints answer with `totalResults`/`totalPages`
 * beside the cursor, and the screen keeps one window over the single stream the
 * infinite query has accumulated — so mobile's "Load more" and the wider links'
 * page numbers are two presentations of the same fetch, not two paginations.
 *
 * Seven screens had this hand-written identically — customers, team, the audit
 * trail, the orders queue, the billing ledger, the mail log, and the mail
 * requests queue — and all seven shared a bug: the jump was implemented as a
 * single `fetchNextPage()` when the target ran past the loaded edge. The page
 * strip always prints the last page as a jump target (`pageWindow`), so
 * clicking it from page 1 pulled in exactly one more cursor page and then
 * sliced an empty window — a blank table the operator could only fix by
 * clicking the same number again, once per cursor page.
 *
 * The catch-up is an effect rather than part of `goToPage` for that reason: it
 * re-runs as each fetched page lands and keeps walking the cursor forward until
 * the requested window is covered or the stream ends.
 */

type CursorPageWindowOptions<Row> = {
  rows: Row[]; // every row loaded so far, in stream order
  totalPages: number;
  totalResults: number;
  pageSize: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  /*
   * Any change to the result set returns the pager to page one — the old offset
   * means nothing against a different filter, and page 4 may not exist in a
   * narrower one. Pass the filters that define the set, e.g.
   * `` `${segment}|${region}|${search}` ``.
   */
  resetKey?: string;
};

type CursorPageWindow<Row> = {
  page: number; // 1-based, for the pager
  rows: Row[]; // the window the table renders
  rangeStart: number; // first result index on screen (1-based), 0 when empty
  rangeEnd: number; // last result index on screen
  isCatchingUp: boolean; // the window is past the loaded edge and fetching
  goToPage: (page: number) => void;
};

export function useCursorPageWindow<Row>({
  rows,
  totalPages,
  totalResults,
  pageSize,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  resetKey,
}: CursorPageWindowOptions<Row>): CursorPageWindow<Row> {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [resetKey]);

  // Fill the whole window, not just its first row: a screen whose page size is
  // wider than the endpoint's `limit` would otherwise print a short page while
  // the stream still had rows for it.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if ((pageIndex + 1) * pageSize <= rows.length) return;
    void fetchNextPage();
  }, [
    pageIndex,
    pageSize,
    rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const windowRows = useMemo(
    () => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [rows, pageIndex, pageSize],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      setPageIndex(Math.max(0, Math.min(nextPage - 1, totalPages - 1)));
    },
    [totalPages],
  );

  return {
    page: pageIndex + 1,
    rows: windowRows,
    rangeStart: totalResults === 0 ? 0 : pageIndex * pageSize + 1,
    rangeEnd: pageIndex * pageSize + windowRows.length,
    // Rows exist, the window is empty, and the stream has more: still walking.
    isCatchingUp: windowRows.length === 0 && rows.length > 0 && hasNextPage,
    goToPage,
  };
}
