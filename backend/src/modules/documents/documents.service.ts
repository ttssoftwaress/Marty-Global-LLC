import {
  OrderDocumentSource,
  OrderDocumentStatus,
  ServiceResultStatus,
} from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { AppError } from '../../lib/app-error.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject } from '../../lib/storage.js';
import type {
  DocumentSource,
  ListDocumentsQuery,
} from './documents.validation.js';

/*
 * Every file the customer has, in one list.
 *
 * There is deliberately NO `Document` model. A file in this system always
 * belongs to something that already owns it — an order, a delivered record, a
 * piece of scanned mail — and each of those owns its own lifecycle, its own
 * ownership check, and its own R2 key. A separate table would be a second source
 * of truth that nothing writes to, which is exactly the failure AGENTS.md
 * records for the card-payment tables ("empty tables that read as a working
 * feature"). So this module READS the three existing sources and presents them
 * under one shape; it never stores a row.
 *
 * The three sources:
 *   order   OrderDocument      — filed certificates and what the customer
 *                                attached to an application
 *   record  ServiceResultValue — the file values on a delivered record
 *   mail    MailItemScan       — the pages of a scanned mail item
 *
 * All Prisma access and every ownership check live here; the controller is an
 * adapter. Object keys never leave this layer — a download link is minted per
 * request after the ownership check (AGENTS.md, Security & PII).
 */

export type DocumentView = {
  // Unique only within its source — `source` + `id` is what addresses a file.
  id: string;
  source: DocumentSource;
  name: string;
  // What the file belongs to, and where to go to see it in context.
  contextLabel: string;
  contextHref: string;
  contentType: string | null;
  sizeBytes: number | null;
  // ISO-8601 UTC. Converted to the customer's timezone at render (AGENTS.md).
  createdAt: string;
  /*
   * False for a document we owe the customer but have not filed yet (a PENDING
   * OrderDocument). The row still lists — "we owe you this" is information —
   * but its download is disabled rather than a link to nothing.
   */
  available: boolean;
};

export type DocumentsPage = {
  documents: DocumentView[];
  totalItems: number;
  totalPages: number;
  nextCursor: string | null;
};

export type DocumentStats = {
  total: number;
  // Files we have filed for them, as distinct from what they sent us. This is
  // the figure that answers "what have I actually received".
  fromUs: number;
  pending: number;
};

/*
 * One document as it exists before presentation: the view plus the object key,
 * which stays inside this module.
 *
 * The three sources are gathered into this shape, then filtered, sorted, and
 * paged as one list — which is why the key travels alongside rather than being
 * looked up again per row on the download path.
 */
type DocumentRow = DocumentView & { objectKey: string | null };

// --- Gathering -----------------------------------------------------------

/*
 * Every order document belonging to this customer.
 *
 * Both sources are included: what we filed (TEAM) and what they uploaded with
 * the application (CUSTOMER). A customer looking for "the passport scan I sent"
 * expects to find it here — hiding their own uploads would make this a partial
 * list that quietly omits half of what exists.
 */
async function gatherOrderDocuments(customerId: string): Promise<DocumentRow[]> {
  const rows = await prisma.orderDocument.findMany({
    where: {
      deletedAt: null,
      // REJECTED is not the customer's to fetch and reads as noise in a
      // document library; it stays on the order where its context explains it.
      status: { not: OrderDocumentStatus.REJECTED },
      order: { customerId, deletedAt: null },
    },
    include: { order: { select: { id: true, reference: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    source: 'order' as const,
    name: row.name,
    contextLabel:
      row.source === OrderDocumentSource.CUSTOMER
        ? `Uploaded to ${row.order.reference}`
        : row.order.reference,
    contextHref: `/app/orders/${row.order.id}`,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    available: row.status === OrderDocumentStatus.AVAILABLE && Boolean(row.objectKey),
    objectKey: row.objectKey,
  }));
}

/*
 * The file values on the customer's delivered records.
 *
 * DRAFT records are excluded for the same reason the portal's own record queries
 * exclude them: a record staff have started but not delivered is not something
 * the customer has. ARCHIVED stays — a dissolved company's certificate is still
 * theirs to download.
 */
async function gatherRecordDocuments(customerId: string): Promise<DocumentRow[]> {
  const rows = await prisma.serviceResultValue.findMany({
    where: {
      objectKey: { not: null },
      result: {
        customerId,
        deletedAt: null,
        status: { not: ServiceResultStatus.DRAFT },
      },
    },
    include: {
      result: { select: { id: true, title: true, reference: true } },
      definition: { select: { label: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    source: 'record' as const,
    /*
     * A file field stores its display name as the scalar (results.values.ts),
     * so that is the filename when we have it. Falling back to the field's own
     * label — "Certificate of incorporation" — reads far better than the key.
     */
    name: row.value?.trim() || row.definition.label,
    contextLabel: row.result.title,
    contextHref: `/app/services/record/${row.result.id}`,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    available: true,
    objectKey: row.objectKey,
  }));
}

/*
 * The scanned pages of the customer's mail.
 *
 * The scan is the document here, not the MailItem: an item is an envelope, and
 * what the customer downloads is a file that was attached to it.
 */
async function gatherMailDocuments(customerId: string): Promise<DocumentRow[]> {
  const rows = await prisma.mailItemScan.findMany({
    where: {
      mailItem: {
        deletedAt: null,
        room: { customerId, deletedAt: null },
      },
    },
    include: {
      mailItem: {
        select: {
          id: true,
          sender: true,
          receivedAt: true,
          roomId: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    source: 'mail' as const,
    name: row.fileName?.trim() || `${row.mailItem.sender} — page ${row.pageNumber}`,
    contextLabel: `Mail from ${row.mailItem.sender}`,
    contextHref: `/app/mailroom/${row.mailItem.roomId}/${row.mailItem.id}`,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    /*
     * When the mail ARRIVED, not when the operator uploaded the scan. The date
     * the customer reasons about is the postmark — a batch scanned late would
     * otherwise all bunch at the top of a newest-first list.
     */
    createdAt: row.mailItem.receivedAt.toISOString(),
    available: true,
    objectKey: row.objectKey,
  }));
}

/*
 * All three sources, gathered.
 *
 * Whole-set gathering rather than three paged queries is a deliberate trade: the
 * list is sorted and paged ACROSS sources, and a merge of three independently
 * paged cursors cannot produce a stable global ordering. The volume this is sized
 * for is one customer's own files — tens, not thousands — and each query is
 * bounded by that customer's rows. If a customer's library ever grows past what
 * one gather can hold, this becomes a UNION query with a real keyset cursor;
 * that is a rewrite of this function alone.
 */
async function gatherAll(
  customerId: string,
  source: ListDocumentsQuery['source'],
): Promise<DocumentRow[]> {
  const [orders, records, mail] = await Promise.all([
    source === 'all' || source === 'order'
      ? gatherOrderDocuments(customerId)
      : [],
    source === 'all' || source === 'record'
      ? gatherRecordDocuments(customerId)
      : [],
    source === 'all' || source === 'mail' ? gatherMailDocuments(customerId) : [],
  ]);

  return [...orders, ...records, ...mail];
}

// --- List ----------------------------------------------------------------

function sortDocuments(
  rows: DocumentRow[],
  sort: ListDocumentsQuery['sort'],
): DocumentRow[] {
  const sorted = [...rows];

  if (sort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return sorted;
  }

  sorted.sort((a, b) =>
    sort === 'oldest'
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  );
  return sorted;
}

export async function listDocuments(
  req: Parameters<typeof getAuth>[0],
  query: ListDocumentsQuery,
): Promise<DocumentsPage> {
  const auth = getAuth(req);

  const gathered = await gatherAll(auth.userId, query.source);

  const search = query.search?.toLowerCase();
  const matched = search
    ? gathered.filter(
        (row) =>
          row.name.toLowerCase().includes(search) ||
          row.contextLabel.toLowerCase().includes(search),
      )
    : gathered;

  const sorted = sortDocuments(matched, query.sort);

  /*
   * The cursor is an offset into this merged, sorted list rather than a row id
   * (AGENTS.md's keyset form): the stream spans three tables, so no single id is
   * a position in it. It is parsed defensively — a stale or hand-edited cursor
   * restarts at the top rather than 500ing on a page the customer can't leave.
   */
  const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;

  const page = sorted.slice(start, start + query.limit);
  const nextOffset = start + page.length;

  return {
    // The object keys stay here — only the view shape crosses the wire.
    documents: page.map(({ objectKey: _objectKey, ...view }) => view),
    totalItems: sorted.length,
    totalPages: Math.max(1, Math.ceil(sorted.length / query.limit)),
    nextCursor: nextOffset < sorted.length ? String(nextOffset) : null,
  };
}

// --- Stats ---------------------------------------------------------------

/*
 * The three headline figures. Derived from the same gather on every read, never
 * stored — a counter would drift the moment a job or an admin files a document
 * outside the path that increments it (the mail-room service says the same).
 */
export async function getStats(
  req: Parameters<typeof getAuth>[0],
): Promise<DocumentStats> {
  const auth = getAuth(req);
  const gathered = await gatherAll(auth.userId, 'all');

  /*
   * "From us" is everything we filed for the customer, which is every source
   * except the files they uploaded to their own applications. Those are marked
   * by the "Uploaded to …" context the order gatherer sets for a CUSTOMER row.
   */
  const uploadedByCustomer = gathered.filter(
    (row) => row.source === 'order' && row.contextLabel.startsWith('Uploaded to '),
  ).length;

  const pending = gathered.filter((row) => !row.available).length;

  return {
    total: gathered.length,
    fromUs: gathered.length - uploadedByCustomer,
    pending,
  };
}

// --- Download ------------------------------------------------------------

/*
 * A short-TTL link to one document, minted per request after the ownership check
 * — never stored, and never handed out with the list (AGENTS.md, Security & PII).
 *
 * The lookup re-runs the source's own ownership-scoped query rather than trusting
 * anything from the list call, so a guessed id from another customer's library
 * resolves to nothing. `source` picks which table the id belongs to; an id is
 * only unique within its own source.
 */
export async function getDownloadLink(
  req: Parameters<typeof getAuth>[0],
  source: DocumentSource,
  documentId: string,
): Promise<{ name: string; url: string }> {
  const auth = getAuth(req);

  const document = await findOwnedDocument(auth.userId, source, documentId);

  if (!document) throw AppError.notFound('Document not found');

  if (!document.available || !document.objectKey) {
    throw AppError.businessRule('That document is not available yet');
  }

  /*
   * `attachment` is what makes this a download rather than a preview: the
   * disposition is signed into the URL, so the file saves under its own name
   * instead of rendering in the tab (lib/storage.ts).
   */
  const url = await presignObject(document.objectKey, {
    disposition: 'attachment',
    fileName: document.name,
  });

  if (!url) {
    throw AppError.businessRule('That document is not available yet');
  }

  return { name: document.name, url };
}

// Re-reads ONE document from its own source, scoped to the customer, so the
// download path never depends on a row the caller supplied.
async function findOwnedDocument(
  customerId: string,
  source: DocumentSource,
  documentId: string,
): Promise<DocumentRow | null> {
  const scope: Record<DocumentSource, () => Promise<DocumentRow[]>> = {
    order: async () => {
      const row = await prisma.orderDocument.findFirst({
        where: {
          id: documentId,
          deletedAt: null,
          status: { not: OrderDocumentStatus.REJECTED },
          order: { customerId, deletedAt: null },
        },
        include: { order: { select: { id: true, reference: true } } },
      });
      if (!row) return [];
      return [
        {
          id: row.id,
          source: 'order',
          name: row.name,
          contextLabel: row.order.reference,
          contextHref: `/app/orders/${row.order.id}`,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          createdAt: row.createdAt.toISOString(),
          available:
            row.status === OrderDocumentStatus.AVAILABLE && Boolean(row.objectKey),
          objectKey: row.objectKey,
        },
      ];
    },
    record: async () => {
      const row = await prisma.serviceResultValue.findFirst({
        where: {
          id: documentId,
          objectKey: { not: null },
          result: {
            customerId,
            deletedAt: null,
            status: { not: ServiceResultStatus.DRAFT },
          },
        },
        include: {
          result: { select: { id: true, title: true } },
          definition: { select: { label: true } },
        },
      });
      if (!row) return [];
      return [
        {
          id: row.id,
          source: 'record',
          name: row.value?.trim() || row.definition.label,
          contextLabel: row.result.title,
          contextHref: `/app/services/record/${row.result.id}`,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          createdAt: row.createdAt.toISOString(),
          available: true,
          objectKey: row.objectKey,
        },
      ];
    },
    mail: async () => {
      const row = await prisma.mailItemScan.findFirst({
        where: {
          id: documentId,
          mailItem: {
            deletedAt: null,
            room: { customerId, deletedAt: null },
          },
        },
        include: {
          mailItem: {
            select: { id: true, sender: true, receivedAt: true, roomId: true },
          },
        },
      });
      if (!row) return [];
      return [
        {
          id: row.id,
          source: 'mail',
          name:
            row.fileName?.trim() || `${row.mailItem.sender} — page ${row.pageNumber}`,
          contextLabel: `Mail from ${row.mailItem.sender}`,
          contextHref: `/app/mailroom/${row.mailItem.roomId}/${row.mailItem.id}`,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          createdAt: row.mailItem.receivedAt.toISOString(),
          available: true,
          objectKey: row.objectKey,
        },
      ];
    },
  };

  const [found] = await scope[source]();
  return found ?? null;
}
