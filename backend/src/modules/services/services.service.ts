import type { Service } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import {
  serviceDetailFieldsSchema,
  serviceFooterSchema,
  type ServiceField,
} from './services.validation.js';

// The service catalog (AGENTS.md: the backend owns the catalog). All Prisma
// access lives here; the controller only shapes the response.

// The catalog shape the portal renders — mirrors the frontend's OrderableService.
export type CatalogService = {
  id: string;
  iconKey: string;
  name: string;
  shortName?: string;
  description: string;
  features: string[];
  footer: { label: string; chips?: string[] };
  detailFields: ServiceField[];
};

// Parse a Service row's Json columns into the typed catalog shape. A row whose
// stored schema is malformed shouldn't take the whole catalog down, so its
// footer/fields fall back to safe defaults and the problem is logged for an
// admin to fix (the row is admin-authored, so a bad shape is an editing bug).
function toCatalogService(service: Service): CatalogService {
  const footer = serviceFooterSchema.safeParse(service.footer);
  const fields = serviceDetailFieldsSchema.safeParse(service.detailFields ?? []);

  if (!footer.success || !fields.success) {
    logger.warn(
      { serviceId: service.id },
      'Service row has a malformed footer/detailFields schema — using fallback',
    );
  }

  return {
    id: service.id,
    iconKey: service.iconKey,
    name: service.name,
    shortName: service.shortName ?? undefined,
    description: service.description,
    features: service.features,
    footer: footer.success ? footer.data : { label: '' },
    detailFields: fields.success ? fields.data : [],
  };
}

// The catalog the Step 1 screen renders: active services only, in display order.
export async function getCatalog(): Promise<CatalogService[]> {
  const services = await prisma.service.findMany({
    where: { active: true, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return services.map(toCatalogService);
}

// Loads the active services for a set of ids, keyed by id, for the orders module
// to resolve a selection against. Returns only the services that exist and are
// active — the caller decides how to treat any missing ids.
export async function getActiveServicesByIds(
  ids: string[],
): Promise<Map<string, CatalogService>> {
  if (ids.length === 0) return new Map();

  const services = await prisma.service.findMany({
    where: { id: { in: ids }, active: true, deletedAt: null },
  });

  return new Map(services.map((s) => [s.id, toCatalogService(s)]));
}
