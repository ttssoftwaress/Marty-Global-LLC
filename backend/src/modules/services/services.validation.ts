import { z } from 'zod';

// The service catalog's wire contract. `detailFields` and `footer` are stored as
// Json on the Service row (so an admin can shape a service without a migration);
// these schemas parse that Json on read, so a malformed row fails loudly here
// rather than reaching the frontend as an untyped blob. They are also the source
// of truth the orders module validates a customer's answers against.

export const serviceFooterSchema = z.object({
  label: z.string().min(1),
  chips: z.array(z.string().min(1)).optional(),
});

const serviceFieldBase = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
});

const serviceTextField = serviceFieldBase.extend({
  type: z.literal('text'),
});

const serviceSelectOption = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const serviceSelectField = serviceFieldBase.extend({
  type: z.literal('select'),
  options: z.array(serviceSelectOption).min(1),
});

const serviceTextareaField = serviceFieldBase.extend({
  type: z.literal('textarea'),
  rows: z.number().int().positive().optional(),
});

export const serviceFieldSchema = z.discriminatedUnion('type', [
  serviceTextField,
  serviceSelectField,
  serviceTextareaField,
]);

export const serviceDetailFieldsSchema = z.array(serviceFieldSchema);

export type ServiceFooter = z.infer<typeof serviceFooterSchema>;
export type ServiceField = z.infer<typeof serviceFieldSchema>;
