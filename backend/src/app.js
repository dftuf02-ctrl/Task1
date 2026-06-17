const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const { globalLimiter } = require('./middleware/rateLimiter');
const { getConfig } = require('./config/env');
const requestIdMiddleware = require('./middleware/requestId');
const requestLoggerMiddleware = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const { sendError } = require('./utils/responseHelper');

const createApp = () => {
  const app = express();
  const config = getConfig();

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
