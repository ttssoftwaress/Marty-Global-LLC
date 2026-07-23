import type { Job } from 'bullmq';

import { deliverEmail } from '../../modules/notifications/notifications.service.js';
import { JobName, type SendEmailJob } from '../queues.js';

// Adapter only — all logic lives in the notifications service (AGENTS.md
// "Backend"). The service is idempotent, so a retry is safe.
export async function notificationsProcessor(job: Job<SendEmailJob>) {
  switch (job.name) {
    case JobName.SEND_EMAIL:
      return deliverEmail(job.data.notificationId);
    default:
      throw new Error(`Unknown notifications job: ${job.name}`);
  }
}
