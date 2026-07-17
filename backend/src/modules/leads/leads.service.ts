import type { Lead } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import type { CreateLeadInput, ListLeadsInput } from './leads.validation.js';

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  return prisma.lead.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      company: input.company ? input.company : null,
      message: input.message,
    },
  });
}

export async function listLeads({ cursor, limit }: ListLeadsInput) {
  const rows = await prisma.lead.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null };
}
