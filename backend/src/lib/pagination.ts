/*
 * Cursor pagination, the API convention in AGENTS.md: `?cursor=&limit=` in,
 * `{ data, nextCursor }` out. Every admin list runs the same two-step — fetch
 * `limit + 1` rows to learn whether more remain, then trim — so it lives here
 * once instead of being re-derived per module.
 *
 * Several admin screens additionally print a numbered pager ("Page 2 of 9") over
 * the same stream. That is a display convenience layered on a cursor, not a
 * second pagination mode: `totalPages` comes from a count, while stepping is
 * still the cursor's job.
 */

export type CursorArgs = { take: number; cursor?: { id: string }; skip?: number };

// Prisma's take/cursor/skip triple for one page. `skip: 1` steps past the cursor
// row itself, which Prisma otherwise includes.
export function cursorArgs(cursor: string | undefined, limit: number): CursorArgs {
  return {
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}

export type Paged<T> = { rows: T[]; nextCursor: string | null };

// Trims the probe row and reports the next cursor. Rows must carry an `id`,
// which is what the cursor is.
export function takePage<T extends { id: string }>(rows: T[], limit: number): Paged<T> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
}

// "Page X of Y" beside a cursor stream. Always at least one page, so an empty
// list reads "Page 1 of 1" rather than "of 0".
export function totalPages(totalResults: number, limit: number): number {
  return Math.max(1, Math.ceil(totalResults / limit));
}
