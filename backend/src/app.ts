import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { auth } from './config/auth.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { routes } from './routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));

  // Better Auth reads the raw request body, so its handler is mounted before
  // express.json() — same rule as the Stripe webhook (AGENTS.md). It owns the
  // whole /api/auth/* subtree (sign-up, sign-in, session, etc.).
  app.all('/api/auth/*splat', toNodeHandler(auth));

  app.use(express.json());

  app.use('/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
