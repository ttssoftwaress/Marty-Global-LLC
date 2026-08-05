import { z } from 'zod';

import { TRASH_ENTITIES } from './trash.registry.js';

/*
 * The wire contract for the trash — the source of truth both apps mirror
 * (AGENTS.md, API Conventions).
 *
 * The entity vocabulary comes from the registry rather than being re-typed here,
 * so adding a table to the trash cannot ship with an endpoint that refuses its
 * own type.
 */

export const trashEntitySchema = z.enum(TRASH_ENTITIES);

/*
 * How many rows one delete may carry.
 *
 * A cap rather than none, because a delete fans out: each row runs its own
 * dependency closure and its own transaction, and a selection of ten thousand
 * ids would be one request holding a connection for minutes. A page of a table
 * is what the UI can actually select, and 200 is comfortably above it.
 */
const MAX_IDS = 200;

const idListSchema = z
  .array(z.string().min(1).max(200))
  .min(1, 'Select at least one row')
  .max(MAX_IDS, `Delete at most ${MAX_IDS} rows at a time`)
  // Duplicates in the payload are a client bug, not a second delete — collapsed
  // here so the service never has to wonder.
  .transform((ids) => [...new Set(ids)]);

export const deleteRowsSchema = z.object({
  entityType: trashEntitySchema,
  ids: idListSchema,
});

export type DeleteRowsInput = z.infer<typeof deleteRowsSchema>;

export const entryIdsSchema = z.object({ ids: idListSchema });

export type EntryIdsInput = z.infer<typeof entryIdsSchema>;

export const listTrashSchema = z.object({
  entityType: trashEntitySchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  // Display only — the numbered pager printed over the cursor stream, exactly as
  // the audit and orders lists do it.
  page: z.coerce.number().int().min(1).optional(),
});

export type ListTrashQuery = z.infer<typeof listTrashSchema>;

/*
 * Retention, bounded at both ends.
 *
 * The floor is 1 rather than 0: a zero-day window is a delete button with no
 * undo behind it wearing the label of one, and `purgeEnabled` is the switch for
 * "stop keeping things" if that is genuinely wanted. The ceiling is five years,
 * which is past any retention period this business has and short of a value
 * somebody typed by accident.
 */
export const trashSettingsSchema = z
  .object({
    retentionDays: z.number().int().min(1).max(1825).optional(),
    purgeEnabled: z.boolean().optional(),
  })
  .refine(
    (input) => input.retentionDays !== undefined || input.purgeEnabled !== undefined,
    { message: 'Nothing to update' },
  );

export type TrashSettingsInput = z.infer<typeof trashSettingsSchema>;
