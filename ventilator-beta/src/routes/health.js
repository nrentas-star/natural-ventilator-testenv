import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ventilator-beta', ts: new Date().toISOString() });
});

export default router;
