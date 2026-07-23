import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { auth } from './config/auth.js';
import { env } from './config/env.js';
import { betterAuthRateLimit } from './guards/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { routes } from './routes.js';

export function createApp() {
  const app = express();

  // Behind the VPS reverse proxy, req.ip is the proxy's address unless we trust
  // the forwarding hop — without this every caller shares one rate-limit bucket.
  // One hop only: a client-supplied X-Forwarded-For must not spoof its way past
  // the limiter.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));

  // Better Auth reads the raw request body, so its handler is mounted before
  // express.json() — same rule as the Stripe webhook (AGENTS.md). It owns the
  // whole /api/auth/* subtree (sign-up, sign-in, session, etc.).
  // The limiter is tiered per auth route (credentials vs. mail dispatch vs.
  // session reads) — see guards/auth-rate-limit.ts. It runs before the handler
  // and dispatches on the path only, never the body, so the raw-body
  // requirement above is unaffected.
  app.all('/api/auth/*splat', betterAuthRateLimit, toNodeHandler(auth));

  app.use(express.json());

  app.use('/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
