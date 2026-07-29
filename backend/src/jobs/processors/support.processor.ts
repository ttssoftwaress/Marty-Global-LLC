import type { Job } from 'bullmq';

import { purgeExpired } from '../../modules/guest/guest.service.js';
import { deliverOfflineHandoff } from '../../modules/support/support.notifications.js';
import { JobName, type SupportHandoffJob } from '../queues.js';

// Adapter only — all logic lives in the module services (AGENTS.md "Backend").
// Both jobs re-derive their decision from the database when they run, so a
// retried or duplicated run is harmless.
export async function supportProcessor(job: Job<SupportHandoffJob>) {
  switch (job.name) {
    case JobName.SUPPORT_OFFLINE_HANDOFF:
      return deliverOfflineHandoff(job.data.conversationId);
    case JobName.PURGE_GUEST_CHATS:
      return purgeExpired();
    default:
      throw new Error(`Unknown support job: ${job.name}`);
  }
}
