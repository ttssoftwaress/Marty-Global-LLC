import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — cannot seed.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const leads = [
  {
    id: 'seed_lead_bright_harbor',
    name: 'Amelia Okafor',
    email: 'amelia@brightharbor.io',
    company: 'Bright Harbor Studio',
    message:
      'We are a two-person design studio looking to form an LLC in Delaware this quarter. What does the filing timeline look like?',
    status: 'NEW' as const,
  },
  {
    id: 'seed_lead_northwind',
    name: 'Daniel Reyes',
    email: 'dreyes@northwindlogistics.com',
    company: 'Northwind Logistics',
    message:
      'Our registered agent is not forwarding scanned mail reliably. Interested in moving our filings and mailroom over to you.',
    status: 'CONTACTED' as const,
  },
  {
    id: 'seed_lead_solo_founder',
    name: 'Priya Raman',
    email: 'priya.raman@gmail.com',
    company: null,
    message:
      'Solo founder, first company. I need help understanding annual report deadlines and what I have to file each year.',
    status: 'NEW' as const,
  },
];

async function main() {
  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {},
      create: lead,
    });
  }

  const count = await prisma.lead.count({ where: { deletedAt: null } });
  console.info(`Seed complete — ${count} lead(s) in the database.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
