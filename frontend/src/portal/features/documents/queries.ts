import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  DocumentLink,
  DocumentSort,
  DocumentSource,
  DocumentSourceFilter,
  DocumentStats,
  DocumentsPage,
} from '../../types/documents';

/*
 * Documents data layer. Everything is scoped to the signed-in customer by the
 * backend, which gathers the list from the three sources that actually own files
 * (orders, delivered records, mail scans).
 *
 * The list is an infinite query over the cursor stream (AGENTS.md, cursor
 * pagination) so the design's two pagination shapes both work over one stream:
 * mobile "Load more" appends, desktop Prev/Next steps a page window — the same
 * approach the mail-room inbox takes.
 */

export const documentStatsKey = () => ['documents', 'stats'] as const;

// GET /v1/documents/stats — the three headline figures.
export function useDocumentStats() {
  return useQuery({
    queryKey: documentStatsKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<DocumentStats>>('/documents/stats').then(
        (res) => res.data,
      ),
  });
}

type DocumentsParams = {
  source: DocumentSourceFilter;
  search: string;
  sort: DocumentSort;
};

export const documentsKey = (params: DocumentsParams) =>
  ['documents', 'list', params.source, params.search, params.sort] as const;

// GET /v1/documents?source=&search=&sort=&cursor=&limit= — one page of the
// customer's documents. The backend resolves the filtering, sorting, counts,
// and pagination across all three sources.
function fetchDocumentsPage(
  params: DocumentsParams,
  cursor: string | null,
): Promise<DocumentsPage> {
  const query = new URLSearchParams({
    source: params.source,
    sort: params.sort,
  });
  if (params.search.trim()) query.set('search', params.search.trim());
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<DocumentsPage>>(
    `/documents?${query.toString()}`,
  ).then((res) => res.data);
}

export function useDocuments(params: DocumentsParams) {
  return useInfiniteQuery({
    queryKey: documentsKey(params),
    queryFn: ({ pageParam }) => fetchDocumentsPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous filter's results on screen while the next load resolves,
    // so changing source/search/sort doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}

/*
 * GET /v1/documents/:source/:documentId/link — a short-TTL download link, minted
 * per request after the ownership check rather than handed out with the list
 * (AGENTS.md, Security & PII).
 *
 * A mutation rather than a query because it is fetched at click time and must
 * never be cached: the URL expires, and a cached one would hand the customer a
 * dead link the second time they press Download.
 */
export function useDocumentLink() {
  return useMutation({
    mutationFn: ({
      source,
      documentId,
    }: {
      source: DocumentSource;
      documentId: string;
    }) =>
      apiFetch<ApiSuccess<DocumentLink>>(
        `/documents/${source}/${documentId}/link`,
      ).then((res) => res.data),
  });
}
