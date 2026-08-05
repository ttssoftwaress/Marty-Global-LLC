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

/*
 * The row. Who wrote in, how to reach them, when, and whether anyone has picked
 * it up — the four things the queue is scanned by.
 *
 * The message itself is deliberately NOT here. It is the one unbounded field on
 * the record, a page of it can arrive from the contact form, and a page of the
 * queue would otherwise carry fifty of them to render four clamped lines. It is
 * served by `getLead` instead, when a reader opens the row that interests them.
 */
export type LeadView = {
  id: string;
  name: string;
  email: string;
  /** First line's worth, for the row — the full text comes from `getLead`. */
  preview: string;
  handled: boolean;
  createdAt: string;
};

/** The expanded row: everything the list left out. */
export type LeadDetail = LeadView & {
  message: string;
  handledAt: string | null;
};

export type LeadsPage = {
  leads: LeadView[];
  openCount: number;
  nextCursor: string | null;
};

const PREVIEW_LENGTH = 120;

// Collapsed whitespace, so a message written with hard line breaks does not
// print as a ragged single line in a fixed-height cell.
function preview(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LENGTH
    ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…`
    : flat;
}

type LeadRecord = {
  id: string;
  name: string;
  email: string;
  message: string;
  handledAt: Date | null;
  createdAt: Date;
};

function toView(row: LeadRecord): LeadView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    preview: preview(row.message),
    handled: row.handledAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(row: LeadRecord): LeadDetail {
  return {
    ...toView(row),
    message: row.message,
    handledAt: row.handledAt?.toISOString() ?? null,
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

/*
 * One lead in full — what the queue's expanded row reads.
 *
 * Fetched when a row is opened rather than shipped with the page, which is the
 * whole reason the list carries a preview: the message is unbounded, and only
 * the row somebody is actually reading needs it.
 */
export async function getLead(id: string): Promise<LeadDetail> {
  const lead = await prisma.contactSubmission.findFirst({
    where: { id, deletedAt: null },
  });
  if (!lead) throw AppError.notFound('Lead not found');

  return toDetail(lead);
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
