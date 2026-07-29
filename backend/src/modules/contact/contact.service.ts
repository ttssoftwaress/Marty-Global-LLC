import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import type { ContactSubmissionInput } from './contact.validation.js';

/*
 * The marketing contact form. A row per submission for the team to work as a
 * queue (`handledAt` marks it done) — there is no auto-reply or routing into
 * support/conversations, because a lead isn't a customer yet and doesn't have a
 * conversation to join.
 */

export async function createSubmission(
  input: ContactSubmissionInput,
  userId?: string,
): Promise<{ id: string }> {
  const submission = await prisma.contactSubmission.create({
    data: {
      name: input.name,
      email: input.email,
      message: input.message,
      userId: userId ?? null,
    },
    select: { id: true },
  });

  logger.info({ submissionId: submission.id }, 'Contact form submitted');

  return submission;
}
