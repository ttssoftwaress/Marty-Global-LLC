import { z } from 'zod';

import { requestTypeKeySchema } from '../../results/results.validation.js';
import { fieldKeySchema as fieldKey } from '../../services/services.validation.js';

/*
 * The admin catalog wire contract (AGENTS.md: Zod schemas are the source of
 * truth). It mirrors `frontend/src/admin/types/catalog.ts` field for field —
 * the admin form is the write side of exactly what the portal's order flow
 * reads, so a shape accepted here is a shape Step 1 and Step 2 must render.
 *
 * MONEY: a tier's price arrives as integer minor units plus an ISO 4217 code and
 * is stored as it arrives (AGENTS.md, Money). The browser captures major units
 * while the admin types and converts once at submit; nothing here parses a
 * decimal string, so no float ever reaches the database.
 */

export const listServicesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;

const iconKey = z.enum([
  'company-formation',
  'virtual-mail-room',
  'bank-account',
  'e-commerce',
  'default',
]);

/*
 * A service's form is stored as REFERENCES into the field registry, never as
 * inline field definitions. A question's label, control type, and choices are
 * owned by `FieldDefinition` and authored on the registry screen; a service
 * records only which registered questions it asks, and whether each is
 * mandatory for this particular service.
 *
 * That is what makes the answer keys a closed set — every key is a registered
 * `fieldKey`, checked against the registry by the service layer — and what makes
 * the customer's merged master form exact: two services picking the same
 * definition are asking the same question by construction.
 */
const fieldRef = z.object({
  fieldKey,
  required: z.boolean().optional(),
});

const formStep = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Must be a lowercase slug'),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
  fields: z.array(fieldRef).max(40),
});

/*
 * What a service RETURNS, as references into the RESULT registry — the mirror of
 * `fieldRef` above, pointing at the other vocabulary.
 *
 * The three optional flags are the per-service overrides that genuinely vary.
 * `isPrimary` names the fact whose value titles a delivered record ("Company
 * name" on a formation); `showInList` puts a fact in the customer's table as a
 * column. Both fall back to the definition's own defaults when absent, which is
 * what makes a well-flagged registry entry pay off across every service.
 */
const resultFieldRef = z.object({
  fieldKey,
  required: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  showInList: z.boolean().optional(),
});

/*
 * A follow-up action the service offers — one button on the customer's result
 * page. `fields` is an optional intake form, referencing the REQUEST registry
 * (the same one the order form uses), so asking "which address should we ship
 * to?" reuses a question that already exists rather than inventing a third
 * vocabulary.
 *
 * `id` is present when editing an existing type and absent when adding one,
 * exactly as `pricingTier` does it.
 */
const serviceRequestType = z.object({
  id: z.string().min(1).optional(),
  key: requestTypeKeySchema,
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
  iconKey: z.string().trim().max(60).optional(),
  turnaround: z.string().trim().max(80).optional(),
  fields: z.array(fieldRef).max(20).superRefine(uniqueFieldKeys).optional(),
  active: z.boolean(),
});

/*
 * At most one fact may be flagged primary: it titles the record, and two titles
 * is not a thing a row can have. The resolver demotes extras defensively at read
 * time, but the write path rejects them so the admin is told at the moment they
 * made the mistake rather than discovering a silently-ignored flag later.
 */
function singlePrimaryResultField(
  fields: { isPrimary?: boolean }[],
  ctx: z.RefinementCtx,
) {
  const primaries = fields.flatMap((field, index) =>
    field.isPrimary ? [index] : [],
  );

  if (primaries.length <= 1) return;

  for (const index of primaries.slice(1)) {
    ctx.addIssue({
      code: 'custom',
      path: [index, 'isPrimary'],
      message: 'Only one field can title the record',
    });
  }
}

// A request type's key identifies it within its service, so two types sharing
// one would make the customer's buttons ambiguous.
function uniqueRequestTypeKeys(types: { key: string }[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  types.forEach((type, index) => {
    if (seen.has(type.key)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'key'],
        message: `This service already offers "${type.key}"`,
      });
    }
    seen.add(type.key);
  });
}

const money = z.object({
  // Integer minor units. Negative is rejected here rather than at the database:
  // a negative price is a business-rule error, not a storage one.
  amount: z.number().int().min(0).max(100_000_000),
  currency: z.string().trim().length(3).toUpperCase(),
});

const pricingTier = z.object({
  // Present when editing an existing tier, absent when adding one.
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(80),
  price: money,
  // Null means "every region this service covers".
  regionCode: z.string().trim().min(1).max(8).nullable(),
  turnaround: z.string().trim().max(80).optional(),
  description: z.string().trim().max(400).optional(),
});

const footer = z.object({
  label: z.string().trim().max(160),
  chips: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

/*
 * Rejects a service picking the same registered field twice: answers are keyed
 * by `fieldKey`, so a duplicate would ask the customer the same question twice
 * and store only one of the two answers.
 *
 * ACROSS services the opposite is true and deliberate. The customer fills in one
 * merged master form, and two services picking the same definition is precisely
 * what marks their questions as the same question — "company_name" on Company
 * Formation and on Bank Account Opening is asked once and the answer recorded
 * against both. Uniqueness is a within-a-service rule only.
 */
function uniqueFieldKeys(fields: { fieldKey: string }[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  fields.forEach((field, index) => {
    if (seen.has(field.fieldKey)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'fieldKey'],
        message: `This service already asks "${field.fieldKey}"`,
      });
    }
    seen.add(field.fieldKey);
  });
}

/*
 * The same rule across a service's steps. Answers land in one flat map per
 * service, so two steps picking the same field would collide exactly as two
 * picks in one step would — the boundary is the service, not the step.
 */
function uniqueStepFieldKeys(
  steps: { fields: { fieldKey: string }[] }[],
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  steps.forEach((step, stepIndex) => {
    step.fields.forEach((field, fieldIndex) => {
      if (seen.has(field.fieldKey)) {
        ctx.addIssue({
          code: 'custom',
          path: [stepIndex, 'fields', fieldIndex, 'fieldKey'],
          message: `"${field.fieldKey}" is already asked on another step`,
        });
      }
      seen.add(field.fieldKey);
    });
  });
}

export const createServiceSchema = z.object({
  iconKey,
  name: z.string().trim().min(1).max(120),
  shortName: z.string().trim().max(60).optional(),
  description: z.string().trim().min(1).max(600),
  features: z.array(z.string().trim().min(1).max(200)).max(20),
  footer,
  detailFields: z.array(fieldRef).max(40).superRefine(uniqueFieldKeys),
  regionCodes: z.array(z.string().trim().min(1).max(8)).max(40),
  pricingTiers: z.array(pricingTier).max(20),
  active: z.boolean(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/*
 * The delivery half of a service, edited on its own detail card rather than in
 * the create modal: a new service is defined by what it sells, and what it
 * returns is decided once the team knows what the filing actually produces.
 */
export const updateResultSchemaSchema = z.object({
  resultFields: z
    .array(resultFieldRef)
    .max(60)
    .superRefine((fields, ctx) => {
      uniqueFieldKeys(fields, ctx);
      singlePrimaryResultField(fields, ctx);
    }),
  // "My companies" — the heading on the customer's page for this service, as
  // distinct from what the thing is called when you buy it. Empty clears it and
  // the page falls back to the service name.
  resultPageTitle: z.string().trim().max(120).optional(),
  resultNoun: z.string().trim().max(60).optional(),
});
export type UpdateResultSchemaInput = z.infer<typeof updateResultSchemaSchema>;

export const updateRequestTypesSchema = z.object({
  requestTypes: z
    .array(serviceRequestType)
    .max(20)
    .superRefine(uniqueRequestTypeKeys),
});
export type UpdateRequestTypesInput = z.infer<typeof updateRequestTypesSchema>;

/*
 * Two screens PATCH the same endpoint with different bodies: the list modal
 * sends the whole service, the detail page sends only the four cards it edits.
 * A PATCH applies what it carries, so every key is optional and the service
 * updates exactly the ones present — a union of the two shapes rather than a
 * partial-of-everything that would let the detail page blank a service's name.
 */
export const updateServiceSchema = z
  .object({
    iconKey: iconKey.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    shortName: z.string().trim().max(60).optional(),
    description: z.string().trim().min(1).max(600).optional(),
    features: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    footer: footer.optional(),
    detailFields: z
      .array(fieldRef)
      .max(40)
      .superRefine(uniqueFieldKeys)
      .optional(),
    formSteps: z
      .array(formStep)
      .max(12)
      .superRefine(uniqueStepFieldKeys)
      .optional(),
    regionCodes: z.array(z.string().trim().min(1).max(8)).max(40).optional(),
    // The detail screen's "Supported regions" card writes this richer shape;
    // the modal writes the plain code list above. Either resolves to the same
    // offering rows.
    regions: z
      .array(
        z.object({
          code: z.string().trim().min(1).max(8),
          enabled: z.boolean(),
          processingTime: z.string().trim().max(80),
        }),
      )
      .max(40)
      .optional(),
    pricingTiers: z.array(pricingTier).max(20).optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
