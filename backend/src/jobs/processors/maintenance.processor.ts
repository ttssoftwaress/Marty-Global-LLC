import type { Job } from 'bullmq';

import { purgeExpired } from '../../modules/admin/trash/trash.service.js';
import { JobName } from '../queues.js';

/*
 * Adapter only — the logic lives in the module service (AGENTS.md, Backend).
 *
 * The sweep re-derives everything when it runs: whether purging is switched on
 * at all, which entries are past their deadline, and whether each one may
 * actually go. So a retried, duplicated, or long-delayed run is harmless — it
 * simply asks the same questions again against the current state.
 */
export async function maintenanceProcessor(job: Job) {
  switch (job.name) {
    case JobName.PURGE_TRASH:
      return purgeExpired();
    default:
      throw new Error(`Unknown maintenance job: ${job.name}`);
  }
}
