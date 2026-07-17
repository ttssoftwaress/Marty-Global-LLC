import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import * as leadsService from './leads.service.js';
import { createLeadSchema } from './leads.validation.js';

const createdIds: string[] = [];

async function seedLead(overrides: Partial<{ name: string; email: string; company: string | null; message: string }> = {}) {
  const lead = await leadsService.createLead({
    name: overrides.name ?? 'Test Person',
    email: overrides.email ?? 'test.person@example.com',
    company: overrides.company === null ? '' : (overrides.company ?? 'Test Co'),
    message: overrides.message ?? 'This is a test enquiry message.',
  });
  createdIds.push(lead.id);
  return lead;
}

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.lead.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('createLeadSchema', () => {
  it('rejects a malformed email', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ada',
      email: 'not-an-email',
      message: 'A sufficiently long message.',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a message shorter than 10 characters', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'too short',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid payload without a company', () => {
    const result = createLeadSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'I would like to form an LLC in Delaware.',
    });
    expect(result.success).toBe(true);
  });
});

describe('leads.service', () => {
  it('persists a lead with NEW status and normalises the email', async () => {
    const lead = await seedLead({ email: 'MixedCase@Example.COM' });

    expect(lead.id).toBeTruthy();
    expect(lead.email).toBe('mixedcase@example.com');
    expect(lead.status).toBe('NEW');
    expect(lead.deletedAt).toBeNull();

    const stored = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(stored?.name).toBe('Test Person');
  });

  it('stores an omitted company as null', async () => {
    const lead = await seedLead({ company: null });
    expect(lead.company).toBeNull();
  });

  it('returns newest leads first and excludes soft-deleted rows', async () => {
    const first = await seedLead({ name: 'First In' });
    const second = await seedLead({ name: 'Second In' });

    const { data } = await leadsService.listLeads({ limit: 20 });
    const ids = data.map((l) => l.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));

    await prisma.lead.update({
      where: { id: second.id },
      data: { deletedAt: new Date() },
    });

    const after = await leadsService.listLeads({ limit: 20 });
    expect(after.data.map((l) => l.id)).not.toContain(second.id);
  });

  it('paginates with a cursor without repeating rows', async () => {
    await seedLead({ name: 'Page A' });
    await seedLead({ name: 'Page B' });
    await seedLead({ name: 'Page C' });

    const page1 = await leadsService.listLeads({ limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await leadsService.listLeads({
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    });

    const overlap = page1.data
      .map((l) => l.id)
      .filter((id) => page2.data.some((l) => l.id === id));
    expect(overlap).toHaveLength(0);
  });
});
