import { env } from '../config/env.js';
import { logger } from './logger.js';
import { applyBucketCors, bucketCorsRules, storageEnabled } from './storage.js';

/*
 * `npm run storage:cors` — apply the bucket's CORS policy.
 *
 * A one-off against Cloudflare, not a boot step: the API has no business
 * rewriting infrastructure config every time it restarts, and the token that
 * runs this needs bucket-level permissions the running service does not.
 *
 * Run it once per bucket, and again whenever the set of origins changes (a new
 * environment, a real domain replacing localhost). Extra origins are passed as
 * arguments and are ADDED to FRONTEND_ORIGIN:
 *
 *   npm run storage:cors -- https://app.martyglobal.com
 *
 * Applying is a full replacement of the rule set — whatever is passed here is
 * what the bucket ends up with, so list every origin that must reach it.
 */

const origins = [...new Set([env.FRONTEND_ORIGIN, ...process.argv.slice(2)])];

const invalid = origins.filter((origin) => {
  try {
    // An origin is scheme + host + port and nothing else. A trailing slash or a
    // path silently never matches, which is indistinguishable from "CORS is
    // broken" — so refuse it here rather than in a browser console later.
    return new URL(origin).origin !== origin;
  } catch {
    return true;
  }
});

if (!storageEnabled) {
  logger.error(
    'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in .env, then re-run.',
  );
  process.exit(1);
} else if (invalid.length > 0) {
  logger.error(
    { invalid },
    'Not valid origins — expected scheme + host + port with no trailing slash',
  );
  process.exit(1);
} else {
  try {
    await applyBucketCors(origins);
    logger.info(
      { bucket: env.R2_BUCKET, rules: bucketCorsRules(origins) },
      'Applied bucket CORS policy',
    );
  } catch (err) {
    logger.error(
      { err },
      'Failed to apply the CORS policy — the R2 API token needs bucket-level permissions ("Admin Read & Write"); an object-scoped token cannot set this',
    );
    process.exitCode = 1;
  }
}
