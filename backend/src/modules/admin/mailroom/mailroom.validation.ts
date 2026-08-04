import { z } from 'zod';

/*
 * The admin virtual mail-ops wire contract. Mirrors
 * `frontend/src/admin/types/mailroom.ts`.
 */

/*
 * Step one of the room picker: matching room names.
 *
 * The picker never fetches unfiltered — the frontend gates the call on two
 * characters and the schema requires them, so "every mail room" is not a query
 * this endpoint can be asked for.
 */
export const roomNameSearchQuerySchema = z.object({
  search: z.string().trim().min(2).max(120),
});
export type RoomNameSearchQuery = z.infer<typeof roomNameSearchQuerySchema>;

/*
 * Step two: the addresses carrying a chosen name. `name` comes from step one's
 * list rather than free typing, so it is required in full — there is no
 * two-character floor to enforce here, and an empty name would ask for every
 * room in the table.
 */
export const roomsByNameQuerySchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type RoomsByNameQuery = z.infer<typeof roomsByNameQuerySchema>;

export const listScansQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListScansQuery = z.infer<typeof listScansQuerySchema>;

/*
 * One uploaded file of a scan. The bytes go straight to R2 through
 * `POST /v1/uploads` (AGENTS.md, Storage); this carries the object key they
 * landed under, so nothing round-trips through the API process.
 *
 * `contentType` is kept because the customer's viewer needs it to choose a
 * renderer — an image page is drawn inline, a PDF is handed to the browser
 * whole — and it must not be re-sniffed from the object at read time.
 */
export const scanFileSchema = z.object({
  objectKey: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().min(1).optional(),
});
export type ScanFileInput = z.infer<typeof scanFileSchema>;

/*
 * Filing a scan into a mail room's inbox.
 *
 * The target is the room, not the customer: a customer may hold several rooms
 * (a Delaware address and a Wyoming one), and an envelope arrives at exactly one
 * of them. Addressing the customer instead would leave the backend guessing
 * which room the post came to — so the operator names the room and the customer
 * follows from it.
 *
 * An envelope is rarely one file: an operator scans several sheets, or attaches
 * a single multi-page PDF. `files` is therefore ordered — position is what
 * becomes the page number — and at least one is required.
 */
/*
 * What the operator is filing.
 *
 * `envelope` is the default because it is the normal flow: post is logged sealed
 * from the outside, the customer asks us to open it, and the contents are
 * scanned onto that same item later (`fileContentsSchema` below). `contents`
 * covers post the customer has standing instructions to open, filed opened in
 * one step — it is the same item shape, just with both halves at once.
 */
export const mailFilingKind = z.enum(['envelope', 'contents']);
export type MailFilingKind = z.infer<typeof mailFilingKind>;

export const uploadScanSchema = z
  .object({
    roomId: z.string().min(1).max(60),
    kind: mailFilingKind.default('envelope'),
    sender: z.string().trim().min(1).max(160),
    // A plain calendar date — the day the physical mail arrived. It has no
    // time-of-day, so it must not be built from a zoneless timestamp
    // (AGENTS.md, Dates); the service anchors it at midnight UTC.
    receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd'),
    files: z.array(scanFileSchema).min(1).max(50),
    notes: z.string().trim().max(500).optional(),
    /*
     * The date the customer has to respond by, when this envelope needs
     * something from them ("Forwarding address required"). Optional — most post
     * is filed to be read, not answered — and it is what files the item as
     * ACTION_REQUESTED instead of NEW.
     *
     * A calendar date like `receivedOn`, for the same reason: a deadline the
     * operator reads off a letter has no time-of-day.
     */
    responseDueOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd')
      .optional(),
  })
  // A due date with no reason gives the customer a deadline and no way to know
  // what it is for; the note is what their inbox row prints beside it.
  .refine((input) => !input.responseDueOn || Boolean(input.notes), {
    path: ['notes'],
    message: 'Say what the customer needs to do before setting a response date',
  });
export type UploadScanInput = z.infer<typeof uploadScanSchema>;

/*
 * Opening a sealed envelope and filing what was inside it onto the item already
 * in the customer's inbox.
 *
 * There is no `roomId` or `sender` here: the item exists, and both are already
 * on it. Re-accepting them would let a scan be filed against one envelope with
 * another's identity, which is the mistake this endpoint is shaped to make
 * impossible.
 *
 * `notes` and `responseDueOn` are accepted because opening the envelope is when
 * an operator first sees the letter — a deadline read off it can only be entered
 * now — and they follow the same rule as the filing form: a deadline needs the
 * note that says what it is for.
 */
export const fileContentsSchema = z
  .object({
    files: z.array(scanFileSchema).min(1).max(50),
    notes: z.string().trim().max(500).optional(),
    responseDueOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd')
      .optional(),
  })
  .refine((input) => !input.responseDueOn || Boolean(input.notes), {
    path: ['notes'],
    message: 'Say what the customer needs to do before setting a response date',
  });
export type FileContentsInput = z.infer<typeof fileContentsSchema>;

// The pending queue's filter strip. `all` and `completed` are not request types
// — they widen or narrow the queue — so they sit alongside the three that are.
export const mailRequestFilter = z.enum([
  'all',
  'scan',
  'forwarding',
  'shredding',
  'completed',
]);
export type MailRequestFilter = z.infer<typeof mailRequestFilter>;

export const listRequestsQuerySchema = z.object({
  filter: mailRequestFilter.default('all'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

/*
 * Settling a request from the slide-over. One shape for both types: the backend
 * decides what settling means for a forwarding versus a shredding request, so
 * the client only reports what the operator entered (AGENTS.md — business logic
 * lives in services).
 */
export const resolveRequestSchema = z.object({
  trackingNumber: z.string().trim().max(80).optional(),
  carrier: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type ResolveRequestInput = z.infer<typeof resolveRequestSchema>;

export const mailLogAction = z.enum(['all', 'forwarded', 'shredded', 'downloaded']);
export const mailLogRange = z.enum(['all', '7d', '30d', '90d']);

export const listLogQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  range: mailLogRange.default('all'),
  action: mailLogAction.default('all'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});
export type ListLogQuery = z.infer<typeof listLogQuerySchema>;
