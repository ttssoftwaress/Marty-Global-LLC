import { Queue, type JobsOptions } from 'bullmq';

import { redis } from '../config/redis.js';

// Queue definitions and producers. The API only ever enqueues from here;
// processors live in jobs/processors and import module services, so the logic
// exists once (AGENTS.md "Backend").

export const QueueName = {
  NOTIFICATIONS: 'notifications',
  PAYMENTS: 'payments',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const JobName = {
  SEND_EMAIL: 'send-email',
  // Sweeps TronGrid for USDT transfers into our deposit address, credits what
  // has confirmed, and expires what timed out. Repeatable — see
  // scheduleUsdtPoll below.
  POLL_USDT: 'poll-usdt',
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

/*
 * The USDT poller's queue. Its retry posture is deliberately different from
 * notifications': a sweep that fails is superseded by the next scheduled sweep a
 * few seconds later, so piling up retries of a stale window only multiplies load
 * against TronGrid during exactly the outage that caused the failure. Nothing is
 * lost by giving up on one sweep — the cursor only advances on success, so the
 * next run re-reads the same window.
 */
export const paymentsQueue = new Queue(QueueName.PAYMENTS, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { age: 60 * 60, count: 200 },
    removeOnFail: { age: 60 * 60 * 24 },
  },
});

export const queues = [notificationsQueue, paymentsQueue];

export type SendEmailJob = {
  notificationId: string;
};

// The job carries only the row id: the payload is already persisted, so a
// delayed retry can never send stale content.
export async function enqueueEmail(payload: SendEmailJob) {
  return notificationsQueue.add(JobName.SEND_EMAIL, payload, {
    // Deduplicates producers that enqueue the same notification twice.
    // BullMQ reserves ':' as its Redis key separator, so a custom jobId can't
    // contain one — use a hyphen.
    jobId: `email-${payload.notificationId}`,
  });
}

/*
 * Register the repeating chain sweep. BullMQ keys a repeatable job by its name +
 * pattern, so calling this on every boot re-registers the same schedule rather
 * than stacking a second one — which matters because every boot runs it.
 *
 * The sweep is idempotent (the tx hash is unique and settlement is
 * transactional), so an overlapping or duplicated run can never double-credit.
 */
export async function scheduleUsdtPoll(everySeconds: number) {
  return paymentsQueue.upsertJobScheduler(
    'usdt-poll',
    { every: everySeconds * 1000 },
    { name: JobName.POLL_USDT, data: {} },
  );
}

export async function closeQueues() {
  await Promise.all(queues.map((queue) => queue.close()));
}
