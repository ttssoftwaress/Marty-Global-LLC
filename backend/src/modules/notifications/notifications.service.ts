import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { render, toPlainText } from '@react-email/components';

import { sendEmail } from '../../config/ses.js';
import { enqueueEmail } from '../../jobs/queues.js';
import { AppError } from '../../lib/app-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import type { SendEmailInput } from './notifications.validation.js';
import { GenericEmail } from './templates/generic-email.js';

// All outbound email flows through here: render → persist → enqueue. Nothing
// sends inline in a request handler (AGENTS.md "Security & PII"), and the
// Notification row is the delivery ledger the processor claims against.

export async function queueEmail(input: SendEmailInput) {
  const element = GenericEmail({
    heading: input.heading,
    body: input.body,
    actionLabel: input.actionLabel,
    actionUrl: input.actionUrl,
  });

  const html = await render(element);
  const text = toPlainText(html);

  const notification = await prisma.notification.create({
    data: {
      channel: NotificationChannel.EMAIL,
      template: input.template,
      recipient: input.to,
      subject: input.subject,
      body: html,
      bodyText: text,
      userId: input.userId,
    },
  });

  await enqueueEmail({ notificationId: notification.id });

  logger.info(
    { notificationId: notification.id, template: input.template },
    'Email queued',
  );

  return notification;
}

export async function getNotification(id: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, deletedAt: null },
  });

  if (!notification) {
    throw AppError.notFound('Notification not found');
  }

  return notification;
}

// Called by the job processor. Idempotent by design: a notification already
// marked SENT short-circuits, so a retried or duplicated job never double-sends.
export async function deliverEmail(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    logger.warn({ notificationId }, 'Notification row missing — job dropped');
    return { delivered: false, reason: 'missing' as const };
  }

  if (notification.status === NotificationStatus.SENT) {
    return { delivered: false, reason: 'already-sent' as const };
  }

  if (notification.channel !== NotificationChannel.EMAIL) {
    throw new Error(
      `Notification ${notificationId} is not an email notification`,
    );
  }

  try {
    const providerRef = await sendEmail({
      to: notification.recipient,
      subject: notification.subject ?? '',
      html: notification.body,
      text: notification.bodyText ?? '',
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        providerRef,
        sentAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    logger.info({ notificationId, providerRef }, 'Email sent');

    return { delivered: true, providerRef };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Stay PENDING while BullMQ still has attempts left; markFailed() flips the
    // row to FAILED once the job is permanently exhausted.
    await prisma.notification.update({
      where: { id: notification.id },
      data: { attempts: { increment: 1 }, lastError: message },
    });

    throw error;
  }
}

export async function markFailed(notificationId: string, reason: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, status: NotificationStatus.PENDING },
    data: { status: NotificationStatus.FAILED, lastError: reason },
  });
}
