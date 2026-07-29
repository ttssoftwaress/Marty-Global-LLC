import pino from 'pino';

import { env, isProduction } from '../config/env.js';

/*
 * Every log line in the backend goes through here (AGENTS.md: "Pino via
 * lib/logger.ts; no console.log in committed code").
 *
 * The redact list is defence in depth, not the control. The real rule is the one
 * in AGENTS.md — log record ids, never PII, card data, or secrets — and Sentry's
 * `beforeSend` scrubber is a far stronger net than this. This exists for the case
 * neither covers: a value that reaches a log line by accident, inside an error
 * object or a spread request, on a path nobody thought to check. Redaction at the
 * serializer means such a value never lands in a file or a log drain in the first
 * place.
 *
 * Paths are matched literally by pino, so each shape a value can arrive under
 * needs its own entry — `password` and `*.password` are two different paths. The
 * wildcard is one level deep by design; anything nested further is a shape we
 * should not be logging at all.
 */
const REDACT_PATHS = [
  // Credentials and tokens, at the top level and one level in — the shape an
  // error or a validated body arrives as.
  'password',
  '*.password',
  'newPassword',
  '*.newPassword',
  'currentPassword',
  '*.currentPassword',
  'secret',
  '*.secret',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'apiKey',
  '*.apiKey',
  'authorization',
  '*.authorization',

  // Request/response shapes, in case a middleware ever logs one whole.
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',

  // Payment and identity fields. There is no card code in this codebase
  // (AGENTS.md, Payments) and there never will be a PAN column — this is the
  // belt on the braces, so a copied-in provider payload cannot log one either.
  'cardNumber',
  '*.cardNumber',
  'cvc',
  '*.cvc',
  'taxId',
  '*.taxId',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  transport: isProduction ? undefined : { target: 'pino-pretty' },
});
