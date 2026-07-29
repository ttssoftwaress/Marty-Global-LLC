import { z } from 'zod';

import { fieldKeySchema } from '../services/services.validation.js';

/*
 * Service delivery's wire contract — what a service RETURNS, and what the
 * customer may ask for afterwards (AGENTS.md: Zod schemas are the source of
 * truth). Mirrored by `frontend/src/portal/types/my-services.ts` (the customer's
 * side) and `frontend/src/admin/types/delivery.ts` (the staff form that writes
 * the values).
 *
 * The mirror image of `services.validation.ts`. That file describes the
 * questions a service ASKS; this one describes the facts it DELIVERS. The
 * structures are deliberately parallel — a registry of definitions, and services
 * holding references into it — because the two are the same idea pointed in
 * opposite directions, and an admin who has learned one has learned both.
 *
 * These schemas parse the Json columns on read, so a malformed row fails loudly
 * here rather than reaching a frontend as an untyped blob.
 */

// --- The result registry --------------------------------------------------

/*
 * The controls a delivered fact can take. The request registry's four, plus four
 * that only make sense as output:
 *
 *   date   — an instant. Stored ISO-8601 UTC, rendered in the viewer's zone.
 *   number — locale-grouped, optionally prefixed/suffixed ("EIN", "shares").
 *   url    — an external link (a state registry page), rendered as an anchor.
 *   status — a chip whose options AND tones the admin defines.
 *
 * `status` is distinct from `select` even though both are a closed choice: a
 * select renders its label as text, a status renders as a coloured chip. The
 * difference is entirely presentational, which is exactly why it is a type and
 * not a flag — the frontend dispatches on type, and a "select that is sometimes
 * a chip" would need a second lookup at every render site.
 */
export const RESULT_FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'file',
  'date',
  'number',
  'url',
  'status',
] as const;
export const resultFieldTypeSchema = z.enum(RESULT_FIELD_TYPES);
export type ResultFieldType = z.infer<typeof resultFieldTypeSchema>;

/*
 * The tones a status chip may take. A closed set rather than free colour, so the
 * design system stays the authority on what each hue means — an admin picks a
 * meaning ("this is bad"), never a hex (Design.md: no hardcoded hex).
 */
export const STATUS_TONES = [
  'neutral',
  'success',
  'warning',
  'error',
  'info',
] as const;
export const statusToneSchema = z.enum(STATUS_TONES);
export type StatusTone = z.infer<typeof statusToneSchema>;

export const resultSelectOptionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
});

export const resultStatusOptionSchema = resultSelectOptionSchema.extend({
  tone: statusToneSchema.default('neutral'),
});

/*
 * Per-type extras, stored in `ResultFieldDefinition.config`. Every key is
 * optional so one schema covers all eight types; the service layer strips the
 * ones that don't apply to the field's own type, so a `date` can never carry a
 * stray `options` array a later reader might act on.
 */
export const resultFieldConfigSchema = z.object({
  // select
  options: z.array(resultSelectOptionSchema).min(1).max(50).optional(),
  // status — its own list, because each choice carries a tone the select's doesn't.
  statusOptions: z.array(resultStatusOptionSchema).min(1).max(20).optional(),
  // textarea
  rows: z.number().int().min(2).max(12).optional(),
  // file
  accept: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  maxSizeMb: z.number().int().min(1).max(50).optional(),
  // number — presentation only. `decimals` is how many places to RENDER; the
  // stored value keeps whatever precision it was given.
  prefix: z.string().trim().max(12).optional(),
  suffix: z.string().trim().max(12).optional(),
  decimals: z.number().int().min(0).max(6).optional(),
  // date — whether the instant carries a meaningful time of day. False renders
  // the date alone, which is what a filing date wants.
  withTime: z.boolean().optional(),
});
export type ResultFieldConfig = z.infer<typeof resultFieldConfigSchema>;

/*
 * One registered result field, resolved for rendering: the definition plus the
 * flags the service that uses it supplied.
 *
 * Deliberately shaped like `serviceFieldSchema` in the request contract, so a
 * frontend that already dispatches on `type` needs no new machinery — only the
 * four new cases.
 */
const resolvedResultBase = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional(),
  hint: z.string().optional(),
  category: z.string().optional(),
  // Resolved per service, never read off the definition directly — see
  // `resultFieldRefSchema` below.
  isPrimary: z.boolean().optional(),
  showInList: z.boolean().optional(),
});

const resultFieldSchema = z.discriminatedUnion('type', [
  resolvedResultBase.extend({ type: z.literal('text') }),
  resolvedResultBase.extend({
    type: z.literal('textarea'),
    rows: z.number().int().positive().optional(),
  }),
  resolvedResultBase.extend({
    type: z.literal('select'),
    options: z.array(resultSelectOptionSchema).min(1),
  }),
  resolvedResultBase.extend({
    type: z.literal('file'),
    accept: z.array(z.string().min(1)).optional(),
    maxSizeMb: z.number().int().positive().optional(),
  }),
  resolvedResultBase.extend({
    type: z.literal('date'),
    withTime: z.boolean().optional(),
  }),
  resolvedResultBase.extend({
    type: z.literal('number'),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    decimals: z.number().int().min(0).max(6).optional(),
  }),
  resolvedResultBase.extend({ type: z.literal('url') }),
  resolvedResultBase.extend({
    type: z.literal('status'),
    statusOptions: z.array(resultStatusOptionSchema).min(1),
  }),
]);
export type ResultField = z.infer<typeof resultFieldSchema>;

// --- A service's result schema, as stored ---------------------------------

/*
 * One fact a service returns: which registered field, and the three per-service
 * overrides.
 *
 * `isPrimary` and `showInList` are properties of the USE, not of the field —
 * "Company name" titles a formation record and is an ordinary column on an
 * annual report — so the service that picks the field decides. Both are
 * optional; absent means "inherit the definition's default", which is what makes
 * registering a sensibly-flagged field pay off across every service that picks it.
 */
export const resultFieldRefSchema = z.object({
  fieldKey: fieldKeySchema,
  required: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  showInList: z.boolean().optional(),
});
export type ResultFieldRef = z.infer<typeof resultFieldRefSchema>;

export const resultFieldRefsSchema = z.array(resultFieldRefSchema);

// --- Request types --------------------------------------------------------

/*
 * A follow-up action's key — how the customer's result page identifies the
 * button it renders. Owned here because this module defines what a request type
 * IS; the admin catalog imports it for the write path so both sides accept
 * exactly the same set of keys.
 */
export const requestTypeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    'Must be lowercase, start with a letter, and contain only letters, numbers, hyphens, or underscores',
  );

// --- Values ---------------------------------------------------------------

/*
 * A single delivered value, as staff submit it. The scalar arrives as a string
 * for every type — the service parses and validates it against the field's own
 * definition, which is the one place that knows what "valid" means for a `date`
 * versus a `number`.
 *
 * A string rather than a union of typed values because the form is one flat map
 * keyed by field, exactly as the order's answers are, and typing it per key is
 * not something a Zod object can express against a runtime-resolved schema. The
 * per-type parse in the service is where the real validation happens.
 */
export const resultValueInputSchema = z.object({
  fieldKey: fieldKeySchema,
  value: z.string().max(10_000).nullable().optional(),
  // Multi-value shapes (a file list) the scalar can't carry.
  valueJson: z.unknown().optional(),
  objectKey: z.string().trim().max(400).optional(),
  contentType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});
export type ResultValueInput = z.infer<typeof resultValueInputSchema>;

// --- Customer-facing queries ---------------------------------------------

export const listResultsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  // The list page's status tabs. `all` is the absence of a filter, so it is not
  // a value here — the tab simply sends nothing.
  status: z.enum(['active', 'archived']).optional(),
});
export type ListResultsQuery = z.infer<typeof listResultsQuerySchema>;

/*
 * What the customer sends when they press a request button. `answers` is the
 * intake form's values keyed by `FieldDefinition.key` — validated in the service
 * against the request type's own field references, never trusted as sent.
 */
export const createServiceRequestSchema = z.object({
  requestTypeId: z.string().min(1),
  answers: z.record(z.string(), z.unknown()).optional(),
  note: z.string().trim().max(2000).optional(),
});
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const listRequestsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .enum(['submitted', 'in_progress', 'blocked', 'completed', 'cancelled'])
    .optional(),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
