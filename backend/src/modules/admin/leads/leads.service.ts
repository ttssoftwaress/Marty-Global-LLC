import type { Prisma } from '@prisma/client';

import { AppError } from '../../../lib/app-error.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import type { ListLeadsQuery } from './leads.validation.js';

/*
 * The marketing contact form's queue. A submission is a lead, not a support
 * conversation — there is no reply thread here, only the record and whether
 * someone has followed up (`handledAt`). Working a lead means calling or
 * emailing the address it carries, outside this system.
 */

export type LeadView = {
  id: string;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  createdAt: string;
};

export type LeadsPage = {
  leads: LeadView[];
  openCount: number;
  nextCursor: string | null;
};

function toView(row: {
  id: string;
  name: string;
  email: string;
  message: string;
  handledAt: Date | null;
  createdAt: Date;
}): LeadView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    handled: row.handledAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listLeads(query: ListLeadsQuery): Promise<LeadsPage> {
  const scope: Prisma.ContactSubmissionWhereInput = { deletedAt: null };

  const where: Prisma.ContactSubmissionWhereInput = {
    ...scope,
    ...(query.status === 'open'
      ? { handledAt: null }
      : query.status === 'handled'
        ? { handledAt: { not: null } }
        : {}),
  };

  const [openCount, rows] = await Promise.all([
    prisma.contactSubmission.count({ where: { ...scope, handledAt: null } }),
    prisma.contactSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    leads: page.rows.map(toView),
    openCount,
    nextCursor: page.nextCursor,
  };
}

// Toggle-able rather than one-way: a lead marked handled by mistake can be
// reopened, and there is no second state a lead can be in.
export async function setHandled(id: string, handled: boolean): Promise<LeadView> {
  const existing = await prisma.contactSubmission.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw AppError.notFound('Lead not found');

  const updated = await prisma.contactSubmission.update({
    where: { id },
    data: { handledAt: handled ? new Date() : null },
  });

  return toView(updated);
}
