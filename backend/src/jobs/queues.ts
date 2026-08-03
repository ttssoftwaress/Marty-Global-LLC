import { Queue, type JobsOptions } from 'bullmq';

import { redis } from '../config/redis.js';

// Queue definitions and producers. The API only ever enqueues from here;
// processors live in jobs/processors and import module services, so the logic
// exists once (AGENTS.md "Backend").

export const QueueName = {
  NOTIFICATIONS: 'notifications',
  PAYMENTS: 'payments',
  SUPPORT: 'support',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const JobName = {
  SEND_EMAIL: 'send-email',
  // Sweeps TronGrid for USDT transfers into our deposit address, credits what
  // has confirmed, and expires what timed out. Repeatable — see
  // scheduleUsdtPoll below.
  POLL_USDT: 'poll-usdt',
  // Runs a few minutes after a customer writes into a support thread and emails
  // them only if nobody answered in the meantime (AGENTS.md, Live Chat: the
  // offline handoff goes through jobs, never inline).
  SUPPORT_OFFLINE_HANDOFF: 'support-offline-handoff',
  // Deletes anonymous visitor chats past their retention window. Repeatable.
  PURGE_GUEST_CHATS: 'purge-guest-chats',
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

/*
 * Live-chat background work. Both of its jobs re-derive their decision from the
 * database when they run rather than trusting what was true when they were
 * enqueued, so a stale job is harmless — see the processor.
 */
export const supportQueue = new Queue(QueueName.SUPPORT, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    /*
     * Removed the moment they finish, which is what makes the conversation-keyed
     * job id below work as a debounce: BullMQ refuses a second job with an id it
     * already holds, so a burst of messages collapses into one pending handoff,
     * and the id frees up for the next burst as soon as this one has run.
     */
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export const queues = [notificationsQueue, paymentsQueue, supportQueue];

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
 * Throw away every email job that has not started yet, and every one that has
 * already given up. Called when an admin switches outbound email off.
 *
 * Safe to do because Redis is not the ledger — the `notification` row is (see
 * the retry note above), and the same settings write marks those rows SUPPRESSED
 * so the record of what was owed survives. What is discarded is the *intent to
 * send*, which is exactly what was just withdrawn.
 *
 * It matters for the same reason the switch does: a failed job lives in Redis
 * for a week (`removeOnFail` above), so without this a monitor counting failed
 * background jobs would keep flipping for days after the sends were stopped, on
 * work nobody can fix. `active` is deliberately not cleaned — a job mid-send is
 * already past the point where removing it changes anything, and it re-checks
 * the switch itself before touching SES (notifications.service.ts).
 */
const DRAINABLE_EMAIL_STATES = ['wait', 'delayed', 'paused', 'failed'] as const;

export async function drainEmailQueue(): Promise<number> {
  let removed = 0;

  for (const state of DRAINABLE_EMAIL_STATES) {
    // grace 0 = "no matter how recent". The limit is a BullMQ requirement, not a
    // budget, so it is set well above any backlog this queue could hold.
    const ids = await notificationsQueue.clean(0, 50_000, state);
    removed += ids.length;
  }

  return removed;
}

/*
 * Register the repeating chain sweep. BullMQ keys a repeatable job by its
 * scheduler id, so calling this on every boot re-registers the same schedule
 * rather than stacking a second one — which matters because every boot runs it.
 *
 * That same property is what lets the interval be an admin setting: the settings
 * write calls this with the new value and the existing scheduler is updated in
 * place, so a change takes effect on the next tick instead of at the next
 * deploy.
 *
 * The sweep is idempotent (the tx hash is unique and settlement is
 * transactional), so an overlapping or duplicated run can never double-credit —
 * including across a reschedule, where an in-flight sweep may overlap the first
 * run of the new cadence.
 */
export async function scheduleUsdtPoll(everySeconds: number) {
  return paymentsQueue.upsertJobScheduler(
    'usdt-poll',
    { every: everySeconds * 1000 },
    { name: JobName.POLL_USDT, data: {} },
  );
}

export type SupportHandoffJob = {
  conversationId: string;
};

/*
 * Arm the offline handoff for a thread the customer just wrote into.
 *
 * The job is delayed, and the "cancel" is that it re-reads the thread when it
 * fires: if an agent replied in the meantime it does nothing. Cancelling the job
 * on reply would be the racier design — the reply and the cancellation could
 * cross — and this way there is one place that decides, at the moment it matters.
 *
 * Keyed by conversation so five messages in quick succession produce one email
 * rather than five.
 */
export async function enqueueSupportHandoff(
  payload: SupportHandoffJob,
  delayMs: number,
) {
  return supportQueue.add(JobName.SUPPORT_OFFLINE_HANDOFF, payload, {
    jobId: `handoff-${payload.conversationId}`,
    delay: delayMs,
  });
}

// Anonymous chats are deleted for good once they go quiet (agreed retention
// rule). Daily is frequent enough for a 7-day window and keeps the sweep small.
export async function scheduleGuestChatPurge(everySeconds: number) {
  return supportQueue.upsertJobScheduler(
    'guest-chat-purge',
    { every: everySeconds * 1000 },
    { name: JobName.PURGE_GUEST_CHATS, data: {} },
  );
}

export async function closeQueues() {
  await Promise.all(queues.map((queue) => queue.close()));
}
