import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as leadsController from './leads.controller.js';

const router = Router();

// Public endpoint — abuse surface, so it is rate-limited per AGENTS.md.
// Turnstile verification is added here once the site key is provisioned.
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many submissions, try again later' },
  },
});

router.post('/', createLimiter, leadsController.createLead);

// TODO: guard with staff/admin once Better Auth lands — read-only for local testing.
router.get('/', leadsController.listLeads);

export const leadsRouter = router;
