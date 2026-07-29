import { z } from 'zod';

export const listLeadsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['all', 'open', 'handled']).default('open'),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
