import { z } from 'zod';

/*
 * The documents wire contract (AGENTS.md: Zod schemas are the source of truth).
 *
 * A "document" here is not a table — it is every file the customer can already
 * reach, gathered into one list. See documents.service.ts for why there is no
 * Document model.
 */

/*
 * Where a document came from. This is the filter the screen's tabs drive, and it
 * doubles as the discriminator the download route needs: an id is only unique
 * WITHIN its source (three different tables mint them), so a composite
 * `source + id` is what addresses one file.
 */
export const documentSource = z.enum(['order', 'record', 'mail']);
export type DocumentSource = z.infer<typeof documentSource>;

export const documentSourceFilter = z.enum(['all', 'order', 'record', 'mail']);
export type DocumentSourceFilter = z.infer<typeof documentSourceFilter>;

/*
 * Newest-first is the default because a document the customer is looking for is
 * usually one that just arrived. Name ordering is offered for the case the list
 * is long enough that "the certificate" is easier to find alphabetically.
 */
export const documentSort = z.enum(['newest', 'oldest', 'name']);
export type DocumentSort = z.infer<typeof documentSort>;

export const listDocumentsQuerySchema = z.object({
  source: documentSourceFilter.default('all'),
  search: z.string().trim().max(120).optional(),
  sort: documentSort.default('newest'),
  cursor: z.string().min(1).optional(),
  // The list renders 10 per page; cap so a client can't ask for an unbounded
  // page. See the service for why this stream's cursor is an offset.
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
