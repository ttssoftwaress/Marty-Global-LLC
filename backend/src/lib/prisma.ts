import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env, isProduction } from '../config/env.js';

// Prisma 7 connects through a driver adapter — the datasource URL no longer
// lives in schema.prisma.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: isProduction ? ['error'] : ['error', 'warn'],
});
