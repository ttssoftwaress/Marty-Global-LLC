import { z } from 'zod';

/*
 * The public `/contact` form's wire contract. Same posture as guest-chat's:
 * short fields, and the Turnstile token is optional in the schema only because
 * config/turnstile.ts is what actually enforces it when a secret is configured.
 */

export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  message: z.string().trim().min(1).max(2_000),
  turnstileToken: z.string().trim().max(2_048).optional(),
});
export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
