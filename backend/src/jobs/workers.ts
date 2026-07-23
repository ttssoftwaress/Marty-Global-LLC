import { Worker, type Job } from 'bullmq';

import { createRedisConnection } from '../config/redis.js';
import { logger } from '../lib/logger.js';
import { markFailed } from '../modules/notifications/notifications.service.js';
import { notificationsProcessor } from './processors/notifications.processor.js';
import { closeQueues, QueueName, type SendEmailJob } from './queues.js';

// Workers run in the same process as the API (AGENTS.md "Backend"). Each gets
// its own Redis connection — a blocking read would otherwise starve producers.

const workers: Worker[] = [];

export function registerWorkers() {
  const notifications = new Worker<SendEmailJob>(
    QueueName.NOTIFICATIONS,
    notificationsProcessor,
    {
      connection: createRedisConnection('marty-worker-notifications'),
      concurrency: 5,
    },
  );

  // Only flip the row to FAILED once BullMQ has exhausted every attempt —
  // earlier failures are still in flight.
  notifications.on(
    'failed',
    (job: Job<SendEmailJob> | undefined, error: Error) => {
      if (!job) return;

      const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

      logger.error(
        {
          err: error,
          jobId: job.id,
          notificationId: job.data.notificationId,
          attempt: job.attemptsMade,
          exhausted,
        },
        'Notification job failed',
      );

      if (exhausted) {
        void markFailed(job.data.notificationId, error.message);
      }
    },
  );

  workers.push(notifications);

  logger.info({ queues: [QueueName.NOTIFICATIONS] }, 'Job workers registered');

  return workers;
}

export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
  await closeQueues();
}
