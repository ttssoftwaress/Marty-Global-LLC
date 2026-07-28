/*
 * Documents — local mirror of the API shapes the documents screen renders. The
 * backend is the source of truth (AGENTS.md, two-apps sync rule).
 *
 * A document is not its own record: the backend gathers every file the customer
 * already has — from their orders, their delivered records, and their scanned
 * mail — into one list. `source` is what says which, and it is half of a
 * document's address, since an id is only unique within its own source.
 *
 * Dates stay ISO-8601 UTC and are formatted only at render (AGENTS.md, Dates).
 * No object keys ever reach the browser: a download link is minted per request.
 */

export type DocumentSource = 'order' | 'record' | 'mail';

// `all` clears the filter; the rest map one-for-one onto a DocumentSource.
export type DocumentSourceFilter = 'all' | DocumentSource;

export type DocumentSort = 'newest' | 'oldest' | 'name';

export type PortalDocument = {
  id: string;
  source: DocumentSource;
  name: string;
  // What the file belongs to ("ORD-10432", "Acme Holdings LLC", "Mail from the
  // State Registry Office") and the portal route that shows it in context.
  contextLabel: string;
  contextHref: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string; // ISO-8601 UTC
  /*
   * False for a document we owe the customer but haven't filed yet. The row
   * still lists — "we owe you this" is information — but its download is
   * disabled rather than a link to nothing.
   */
  available: boolean;
};

// The three headline figures across the top of the page.
export type DocumentStats = {
  total: number;
  fromUs: number; // filed by us, as distinct from what the customer sent us
  pending: number;
};

// One page of the customer's documents. Cursor-paginated (AGENTS.md); the
// backend resolves the source filter, search, sort, counts, and window.
export type DocumentsPage = {
  documents: PortalDocument[];
  totalItems: number; // total matching the current filters, for "Showing X of Y"
  totalPages: number;
  nextCursor: string | null;
};

// The short-TTL link behind a Download control, fetched at click time.
export type DocumentLink = {
  name: string;
  url: string;
};
