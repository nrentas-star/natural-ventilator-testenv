import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { cfg } from './src/config.js';
import healthRouter     from './src/routes/health.js';
import authRouter       from './src/routes/auth.js';
import toolsRouter      from './src/routes/tools.js';
import ventilatorRouter from './src/routes/ventilator.js';
import betaRouter       from './src/routes/beta.js';
import feedbackRouter   from './src/routes/feedback.js';

const app = express();
app.disable('x-powered-by');

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('X-Frame-Options', 'DENY');          // overridden per-route for iframe
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ── Body / cookie parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(cookieParser());

// ── Access log ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () =>
    console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now()-t}ms`)
  );
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(healthRouter);     // GET /health    — public
app.use(authRouter);       // /auth/*        — public OTP flow + logout
app.use(feedbackRouter);   // POST /feedback — auth-guarded in the route
app.use(betaRouter);       // /ventilator/beta/* — auth + beta required
app.use(ventilatorRouter); // /ventilator*   — auth + beta flag required
app.use(toolsRouter);      // GET /          — auth required (must be last)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).send('Not found'));

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).send('Internal server error');
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(cfg.PORT, '127.0.0.1', () => {
  console.log(`ventilator-beta v1.1.0 listening on port ${cfg.PORT}`);
  console.log(`Cookie: ${cfg.COOKIE_NAME} @ Domain=${cfg.COOKIE_DOMAIN}`);
});
