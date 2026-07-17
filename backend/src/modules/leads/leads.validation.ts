import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.email('A valid email is required').max(254),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export const listLeadsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type ListLeadsInput = z.infer<typeof listLeadsSchema>;
