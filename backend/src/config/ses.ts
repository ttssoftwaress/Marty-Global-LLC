import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';

import { logger } from '../lib/logger.js';
import { env, isProduction } from './env.js';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Credentials are optional in dev/test (config/env.ts). Without them SES would
// fail on every send, so the transport logs the envelope instead — production
// requires real keys.
const hasCredentials = Boolean(
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY,
);

if (isProduction && !hasCredentials) {
  logger.error('SES credentials missing — outbound email will not be sent');
}

const client = hasCredentials
  ? new SESClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

const source = `${env.SES_FROM_NAME} <${env.SES_FROM_EMAIL}>`;

// Returns the provider message id so the caller can persist it against the
// notification row. Never log recipient addresses or body content (AGENTS.md
// "Security & PII") — the subject is safe, the rest is not.
export async function sendEmail(input: SendEmailInput): Promise<string> {
  if (!client) {
    logger.warn(
      { subject: input.subject },
      'SES not configured — email skipped',
    );
    return 'ses-disabled';
  }

  const command = new SendEmailCommand({
    Source: source,
    Destination: { ToAddresses: [input.to] },
    ReplyToAddresses: env.SES_REPLY_TO_EMAIL
      ? [env.SES_REPLY_TO_EMAIL]
      : undefined,
    ConfigurationSetName: env.SES_CONFIGURATION_SET,
    Message: {
      Subject: { Data: input.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: input.html, Charset: 'UTF-8' },
        Text: { Data: input.text, Charset: 'UTF-8' },
      },
    },
  });

  const result = await client.send(command);

  if (!result.MessageId) {
    throw new Error('SES accepted the request without returning a MessageId');
  }

  return result.MessageId;
}

export const sesEnabled = hasCredentials;
