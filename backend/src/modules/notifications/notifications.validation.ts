import { z } from 'zod';

// The wire contract for queued notifications. Producers hand the service one of
// these; it renders and persists before anything is enqueued.

export const emailTemplate = z.enum(['generic']);

export type EmailTemplate = z.infer<typeof emailTemplate>;

export const sendEmailSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200),
  template: emailTemplate.default('generic'),
  heading: z.string().min(1).max(200),
  body: z.string().min(1).max(5_000),
  actionLabel: z.string().min(1).max(60).optional(),
  actionUrl: z.url().optional(),
  userId: z.string().min(1).optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
