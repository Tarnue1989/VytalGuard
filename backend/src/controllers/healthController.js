import { getSequelize } from '../config/database.js';

export const ping = (_req, res) => {
  res.json({
    ok: true,
    service: 'VytalGuard API',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString()
  });
};

// Readiness endpoint for load balancers
export const ready = async (_req, res) => {
  try {
    await getSequelize().authenticate();
    res.json({ ready: true, time: new Date().toISOString() });
  } catch (_e) {
    res.status(503).json({ ready: false, error: 'db_unavailable' });
  }
};
