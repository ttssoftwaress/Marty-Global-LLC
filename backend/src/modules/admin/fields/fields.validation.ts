import { z } from 'zod';

import {
  fieldKeySchema,
  fieldTypeSchema,
  selectOptionSchema,
} from '../../services/services.validation.js';

/*
 * The field registry's wire contract (AGENTS.md: Zod schemas are the source of
 * truth). Mirrors `frontend/src/admin/types/fields.ts`.
 *
 * The registry is the vocabulary every service form is built from, so this is
 * the one place a question's shape is authored. A service picks from it; it
 * never defines a question of its own.
 *
 * `key` appears only on create. It is the identifier every answer is stored
 * under, so it is immutable once a field exists — the update schema simply has
 * no key to send, which is the cleanest way to make that unrepresentable rather
 * than a runtime check.
 */

export const listFieldsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(120).optional(),
  type: fieldTypeSchema.optional(),
  // The picker wants live fields only; the management screen shows both.
  includeArchived: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
});
export type ListFieldsQuery = z.infer<typeof listFieldsQuerySchema>;

const label = z.string().trim().min(1).max(120);
const placeholder = z.string().trim().max(160);
const hint = z.string().trim().max(240);
const category = z.string().trim().max(60);

/*
 * The per-type extras. Validated per type by the refinement below rather than as
 * a discriminated union, because the form edits one flat object and clearing a
 * type's settings should not require re-sending the whole field.
 */
const config = z.object({
  options: z.array(selectOptionSchema).max(50).optional(),
  rows: z.number().int().min(2).max(12).optional(),
  accept: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  maxSizeMb: z.number().int().min(1).max(50).optional(),
  multiple: z.boolean().optional(),
});

const fieldBody = {
  label,
  type: fieldTypeSchema,
  placeholder: placeholder.optional(),
  hint: hint.optional(),
  category: category.optional(),
  config: config.optional(),
  archived: z.boolean().optional(),
};

/*
 * A dropdown must offer at least one choice. Enforced here rather than in the
 * shape above because it depends on the sibling `type` — and a select with no
 * options is a field the customer can never answer, so it must not be storable
 * in the first place.
 */
function requireSelectOptions(
  value: { type: string; config?: { options?: unknown[] } },
  ctx: z.RefinementCtx,
) {
  if (value.type === 'select' && !value.config?.options?.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['config', 'options'],
      message: 'A dropdown needs at least one choice',
    });
  }
}

export const createFieldSchema = z
  .object({ key: fieldKeySchema, ...fieldBody })
  .superRefine(requireSelectOptions);
export type CreateFieldInput = z.infer<typeof createFieldSchema>;

/*
 * The update body. No `key`: an answer key is immutable (see above).
 *
 * `type` may be sent, but the service refuses to change it once any service
 * references the field — switching a live text question to a dropdown would
 * leave every answer already recorded against it invalid.
 */
export const updateFieldSchema = z
  .object({
    label: label.optional(),
    type: fieldTypeSchema.optional(),
    placeholder: placeholder.optional(),
    hint: hint.optional(),
    category: category.optional(),
    config: config.optional(),
    archived: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  })
  .superRefine((value, ctx) => {
    if (value.type) requireSelectOptions({ type: value.type, ...value }, ctx);
  });
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
