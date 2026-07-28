import { Worker, type Job } from 'bullmq';

import { createRedisConnection } from '../config/redis.js';
import { tronConfig } from '../config/tron.js';
import { logger } from '../lib/logger.js';
import { markFailed } from '../modules/notifications/notifications.service.js';
import { notificationsProcessor } from './processors/notifications.processor.js';
import { paymentsProcessor } from './processors/payments.processor.js';
import { supportProcessor } from './processors/support.processor.js';
import {
  closeQueues,
  QueueName,
  scheduleUsdtPoll,
  type SendEmailJob,
} from './queues.js';

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

      // This handler is not awaited by BullMQ, so a rejected markFailed would
      // surface as an unhandled rejection and take the worker process down —
      // precisely when persistence is already struggling.
      if (exhausted) {
        markFailed(job.data.notificationId, error.message).catch(
          (err: unknown) => {
            logger.error(
              { err, notificationId: job.data.notificationId },
              'Failed to persist FAILED status for exhausted notification job',
            );
          },
        );
      }
    },
  );

  workers.push(notifications);

  /*
   * The USDT chain sweep. Concurrency 1 deliberately: the sweep is idempotent,
   * but running one at a time keeps our TronGrid request rate predictable and
   * means the cursor is only ever advanced by one writer.
   */
  const payments = new Worker(QueueName.PAYMENTS, paymentsProcessor, {
    connection: createRedisConnection('marty-worker-payments'),
    concurrency: 1,
  });

  payments.on('failed', (job: Job | undefined, error: Error) => {
    // A failed sweep is superseded by the next one — the cursor did not advance,
    // so nothing is lost. Logged at error level because a persistent failure
    // means payments are not being credited.
    logger.error(
      { err: error, jobId: job?.id, attempt: job?.attemptsMade },
      'USDT poll failed',
    );
  });

  workers.push(payments);

  /*
   * Live chat's background work: the offline email handoff and the anonymous
   * chat purge. Both are cheap and infrequent, so a small concurrency is ample —
   * and the handoff is keyed per conversation, so parallelism buys nothing.
   */
  const support = new Worker(QueueName.SUPPORT, supportProcessor, {
    connection: createRedisConnection('marty-worker-support'),
    concurrency: 3,
  });

  support.on('failed', (job: Job | undefined, error: Error) => {
    // No conversation id in the log line beyond the job's own data — and never a
    // message body (AGENTS.md, PII).
    logger.error(
      { err: error, jobId: job?.id, name: job?.name, attempt: job?.attemptsMade },
      'Support job failed',
    );
  });

  workers.push(support);

  // Idempotent: BullMQ keys the scheduler by id, so re-running on every boot
  // updates the same schedule rather than stacking another.
  void scheduleUsdtPoll(tronConfig.pollIntervalSeconds).catch((err: unknown) => {
    logger.error({ err }, 'Failed to schedule the USDT poll');
  });

  logger.info(
    { queues: [QueueName.NOTIFICATIONS, QueueName.PAYMENTS, QueueName.SUPPORT] },
    'Job workers registered',
  );

  return workers;
}

export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
  await closeQueues();
}
