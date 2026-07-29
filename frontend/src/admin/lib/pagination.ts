/*
 * The page-number window shared by every admin pager.
 *
 * Seven screens paginate a cursor-backed list (AGENTS.md) and each had a
 * byte-identical copy of this function — the same off-by-one edge cases waiting
 * to be fixed seven times. The presentations genuinely differ (a pill strip
 * under the customers table, a compact strip inside the mail log card), but the
 * arithmetic never did, so it lives here and the visuals stay per-screen.
 *
 * Returns the page numbers to print: a sliding window of `windowSize`, always
 * including the first and last page, with `null` marking an elided run. The
 * window keeps a list hundreds of pages deep at a fixed footer width.
 */

export function pageWindow(
  page: number,
  totalPages: number,
  windowSize = 3,
): (number | null)[] {
  if (totalPages <= windowSize + 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(windowSize / 2);
  let start = Math.max(2, page - half);
  const end = Math.min(totalPages - 1, start + windowSize - 1);
  start = Math.max(2, end - windowSize + 1);

  const pages: (number | null)[] = [1];
  if (start > 2) pages.push(null);
  for (let current = start; current <= end; current += 1) pages.push(current);
  if (end < totalPages - 1) pages.push(null);
  pages.push(totalPages);

  return pages;
}
