import { Router } from 'express';

const router = Router();

// Public, unauthenticated — liveness probe for the VPS / container.
router.get('/', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});

export const healthRouter = router;
