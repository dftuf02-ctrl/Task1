const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    credentials: true,
    maxAge: 86400,
  }));

  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Rate limiting
  app.use(rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
      errors: [],
    },
  }));

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
