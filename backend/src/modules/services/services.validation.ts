import { z } from 'zod';

/*
 * The service catalog's wire contract, and the field registry it draws on.
 *
 * A service's form is stored as REFERENCES into the registry, not as inline
 * field definitions. `FieldDefinition` owns what a question is — its key, label,
 * control type, and per-type config — and a service records only which
 * registered questions it asks. That is what keeps answer keys a closed set:
 * every key in `OrderItem.answers` is a `FieldDefinition.key`, so nothing in the
 * database depends on an admin having typed a name consistently.
 *
 * These schemas parse the Json columns on read, so a malformed row fails loudly
 * here rather than reaching a frontend as an untyped blob. They are also the
 * source of truth the orders module validates a customer's answers against.
 */

export const serviceFooterSchema = z.object({
  label: z.string().min(1),
  chips: z.array(z.string().min(1)).optional(),
});

// --- The field registry ---------------------------------------------------

export const FIELD_TYPES = ['text', 'select', 'textarea', 'file'] as const;
export const fieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof fieldTypeSchema>;

/*
 * The answer key. Constrained so it can never collide with a Json path
 * separator, arrive as an empty-ish string, or differ from another key only by
 * case — the registry is meant to make keys predictable, so the format is
 * enforced rather than left to convention.
 */
export const fieldKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Must be lowercase, start with a letter, and contain only letters, numbers, or underscores',
  );

export const selectOptionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
});

/*
 * Per-type extras, stored in `FieldDefinition.config`. Every key is optional so
 * one schema covers all four types; the service layer strips the ones that don't
 * apply to the field's own type, so a text field can never carry a stray
 * `maxSizeMb` that a later reader might act on.
 */
export const fieldConfigSchema = z.object({
  // select
  options: z.array(selectOptionSchema).min(1).max(50).optional(),
  // textarea
  rows: z.number().int().min(2).max(12).optional(),
  // file
  accept: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  maxSizeMb: z.number().int().min(1).max(50).optional(),
  multiple: z.boolean().optional(),
});
export type FieldConfig = z.infer<typeof fieldConfigSchema>;

/*
 * One registered field, as every consumer reads it. This is the resolved shape a
 * service's form is rendered from — the reference plus the definition it points
 * at, flattened, with `required` coming from the service that asked.
 *
 * It is deliberately identical to the shape both frontends already render by
 * `type`, so resolving a reference produces exactly the field object the portal
 * and the order-detail screens were already built for.
 */
const resolvedFieldBase = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
});

export const serviceFieldSchema = z.discriminatedUnion('type', [
  resolvedFieldBase.extend({ type: z.literal('text') }),
  resolvedFieldBase.extend({
    type: z.literal('select'),
    options: z.array(selectOptionSchema).min(1),
  }),
  resolvedFieldBase.extend({
    type: z.literal('textarea'),
    rows: z.number().int().positive().optional(),
  }),
  resolvedFieldBase.extend({
    type: z.literal('file'),
    accept: z.array(z.string().min(1)).optional(),
    maxSizeMb: z.number().int().positive().optional(),
    multiple: z.boolean().optional(),
  }),
]);

export const serviceDetailFieldsSchema = z.array(serviceFieldSchema);

// --- A service's form, as stored ------------------------------------------

/*
 * One question on a service's form: which registered field, and whether this
 * particular service requires an answer. Nothing else — a service may not
 * override a field's label, type, or choices, because that is exactly the
 * per-service drift the registry exists to prevent.
 */
export const fieldRefSchema = z.object({
  fieldKey: fieldKeySchema,
  required: z.boolean().optional(),
});
export type FieldRef = z.infer<typeof fieldRefSchema>;

export const fieldRefsSchema = z.array(fieldRefSchema);

export const formStepRefSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  fields: fieldRefsSchema,
});

export const formStepRefsSchema = z.array(formStepRefSchema);

export type ServiceFooter = z.infer<typeof serviceFooterSchema>;
export type ServiceField = z.infer<typeof serviceFieldSchema>;
export type FormStepRef = z.infer<typeof formStepRefSchema>;

/*
 * The resolved step shape — a stored step with its references turned into real
 * fields. What both frontends render.
 */
export type ServiceFormStep = {
  key: string;
  title: string;
  description?: string;
  fields: ServiceField[];
};
