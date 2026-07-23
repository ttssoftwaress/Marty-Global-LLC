import { Queue, type JobsOptions } from 'bullmq';

import { redis } from '../config/redis.js';

// Queue definitions and producers. The API only ever enqueues from here;
// processors live in jobs/processors and import module services, so the logic
// exists once (AGENTS.md "Backend").

export const QueueName = {
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const JobName = {
  SEND_EMAIL: 'send-email',
} as const;

export type JobName = (typeof JobName)[keyof typeof JobName];

// Every processor is idempotent, so retries are safe. Exponential backoff keeps
// a provider outage from hammering SES; completed jobs are trimmed because the
// Notification row — not Redis — is the delivery ledger.
const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
  removeOnFail: { age: 60 * 60 * 24 * 7 },
};

export const notificationsQueue = new Queue(QueueName.NOTIFICATIONS, {
  connection: redis,
  defaultJobOptions,
});

export const queues = [notificationsQueue];

export type SendEmailJob = {
  notificationId: string;
};

// The job carries only the row id: the payload is already persisted, so a
// delayed retry can never send stale content.
export async function enqueueEmail(payload: SendEmailJob) {
  return notificationsQueue.add(JobName.SEND_EMAIL, payload, {
    // Deduplicates producers that enqueue the same notification twice.
    jobId: `email:${payload.notificationId}`,
  });
}

export async function closeQueues() {
  await Promise.all(queues.map((queue) => queue.close()));
}
