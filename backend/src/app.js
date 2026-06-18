const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const { globalLimiter } = require('./middleware/rateLimiter');
const { getConfig } = require('./config/env');
const requestIdMiddleware = require('./middleware/requestId');
const requestLoggerMiddleware = require('./middleware/requestLogger');
const metricsMiddleware = require('./middleware/metrics');
const podInfoMiddleware = require('./middleware/podInfo');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const { register } = require('./config/metrics');
const { sendError } = require('./utils/responseHelper');

const createApp = () => {
  const app = express();
  const config = getConfig();

  // Behind an ingress/LB: trust the proxy so req.ip is the real client IP,
  // otherwise the per-IP auth rate limiter buckets everyone on the proxy
  // address and brute-force protection is effectively disabled.
  app.set('trust proxy', config.trustProxy);

  // ── Security Middleware ────────────────────────────────────
  // Secure HTTP headers
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
    credentials: true,
    maxAge: 86400,
  }));

  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Tag every response with the serving pod (proves load-balancing in k8s).
  app.use(podInfoMiddleware);

  // ── Metrics (Prometheus) ──────────────────────────────────
  // Record RED metrics for every request, and expose /metrics BEFORE auth
  // and rate limiting so scrapes are never throttled or blocked.
  app.use(metricsMiddleware);
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(err.message);
    }
  });

  // Rate limiting (Redis-backed). Global limiter keyed by client IP
  // for baseline protection; task routes additionally enforce a
  // per-user limit after authentication.
  app.use(globalLimiter());

  // ── Body Parsing ──────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  // ── Observability Middleware ───────────────────────────────
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // ── Routes ────────────────────────────────────────────────
  app.use(routes);

  // ── 404 Handler ───────────────────────────────────────────
  app.use((_req, res) => {
    sendError(res, 'Resource not found', [], 404);
  });

  // ── Global Error Handler ──────────────────────────────────
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
