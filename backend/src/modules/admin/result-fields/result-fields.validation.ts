import { z } from 'zod';

import { fieldKeySchema } from '../../services/services.validation.js';
import {
  resultFieldTypeSchema,
  resultSelectOptionSchema,
  resultStatusOptionSchema,
} from '../../results/results.validation.js';

/*
 * The result registry's wire contract — the vocabulary of facts a service can
 * RETURN (AGENTS.md: Zod schemas are the source of truth). Mirrors
 * `frontend/src/admin/types/result-fields.ts`.
 *
 * Deliberately parallel to `fields.validation.ts`, the request registry's
 * contract, down to the same rules: `key` appears only on create, because it is
 * the identifier every delivered value is stored under and renaming one would
 * orphan the records that hold it. Making it unrepresentable in the update
 * schema is cleaner than a runtime check.
 */

export const listResultFieldsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(120).optional(),
  type: resultFieldTypeSchema.optional(),
  includeArchived: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
});
export type ListResultFieldsQuery = z.infer<typeof listResultFieldsQuerySchema>;

const label = z.string().trim().min(1).max(120);
const hint = z.string().trim().max(240);
const category = z.string().trim().max(60);

/*
 * Per-type extras, edited as one flat object (the form clears a type's settings
 * without re-sending the whole field), then narrowed per type by the refinement
 * below and stripped to the type's own keys in the service.
 */
const config = z.object({
  options: z.array(resultSelectOptionSchema).max(50).optional(),
  statusOptions: z.array(resultStatusOptionSchema).max(20).optional(),
  rows: z.number().int().min(2).max(12).optional(),
  accept: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  maxSizeMb: z.number().int().min(1).max(50).optional(),
  prefix: z.string().trim().max(12).optional(),
  suffix: z.string().trim().max(12).optional(),
  decimals: z.number().int().min(0).max(6).optional(),
  withTime: z.boolean().optional(),
});

const resultFieldBody = {
  label,
  type: resultFieldTypeSchema,
  hint: hint.optional(),
  category: category.optional(),
  config: config.optional(),
  // Defaults the picking service inherits unless it overrides them. See
  // `ResultFieldDefinition.isPrimary` in the schema for why they live in two
  // places.
  isPrimary: z.boolean().optional(),
  showInList: z.boolean().optional(),
  archived: z.boolean().optional(),
};

/*
 * A choice-type field must offer at least one choice. Enforced here rather than
 * in the shape above because it depends on the sibling `type` — and a status
 * field with no options is one no staff member could ever fill, so it must not
 * be storable in the first place.
 */
function requireChoices(
  value: {
    type: string;
    config?: { options?: unknown[]; statusOptions?: unknown[] };
  },
  ctx: z.RefinementCtx,
) {
  if (value.type === 'select' && !value.config?.options?.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['config', 'options'],
      message: 'A dropdown needs at least one choice',
    });
  }

  if (value.type === 'status' && !value.config?.statusOptions?.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['config', 'statusOptions'],
      message: 'A status field needs at least one state',
    });
  }
}

export const createResultFieldSchema = z
  .object({ key: fieldKeySchema, ...resultFieldBody })
  .superRefine(requireChoices);
export type CreateResultFieldInput = z.infer<typeof createResultFieldSchema>;

export const updateResultFieldSchema = z
  .object({
    label: label.optional(),
    type: resultFieldTypeSchema.optional(),
    hint: hint.optional(),
    category: category.optional(),
    config: config.optional(),
    isPrimary: z.boolean().optional(),
    showInList: z.boolean().optional(),
    archived: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  })
  .superRefine((value, ctx) => {
    if (value.type) requireChoices({ type: value.type, ...value }, ctx);
  });
export type UpdateResultFieldInput = z.infer<typeof updateResultFieldSchema>;
