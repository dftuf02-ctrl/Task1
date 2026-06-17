const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient, isRedisHealthy } = require('../config/redis');
const { getConfig } = require('../config/env');

/**
 * Per-identity key:
 *   - authenticated requests are limited per user id
 *   - anonymous requests fall back to the client IP
 */
const keyGenerator = (req) => (req.user ? `user:${req.user.id}` : req.ip);

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    errors: [],
  },
};

/**
 * Builds a rate-limiting middleware.
 *
 * Preferentially backed by Redis (rate-limit-redis) so limits are
 * shared across all API instances. If Redis is unreachable it falls
 * back to an in-memory limiter (per-instance) so the API keeps serving
 * traffic, and automatically resumes using Redis once it reconnects.
 *
 * In the test environment only the in-memory limiter is used so the
 * suite doesn't require a live Redis server.
 *
 * @param {{ windowMs: number, max: number, prefix: string }} opts
 */
const createRateLimiter = ({ windowMs, max, prefix }) => {
  const config = getConfig();

  const memoryLimiter = rateLimit({ ...baseOptions, windowMs, max });

  if (config.isTest) {
    return memoryLimiter;
  }

  const client = getRedisClient();
  const redisLimiter = rateLimit({
    ...baseOptions,
    windowMs,
    max,
    store: new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (...args) => client.call(...args),
    }),
  });

  // Pick the backing limiter per request based on live Redis health.
  return (req, res, next) =>
    (isRedisHealthy() ? redisLimiter : memoryLimiter)(req, res, next);
};

/**
 * Global limiter applied to every request (RATE_LIMIT_MAX per window).
 */
const globalLimiter = () => {
  const config = getConfig();
  return createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    prefix: 'global',
  });
};

/**
 * Stricter limiter for auth endpoints to slow brute-force attempts
 * (AUTH_RATE_LIMIT_MAX per window, keyed by IP).
 */
const authLimiter = () => {
  const config = getConfig();
  return createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.authRateLimitMax,
    prefix: 'auth',
  });
};

/**
 * Per-user limiter for protected resource routes. Must run AFTER
 * `authenticate` so requests are counted per user id (RATE_LIMIT_MAX
 * requests per user per window).
 */
const userLimiter = () => {
  const config = getConfig();
  return createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    prefix: 'user',
  });
};

module.exports = { createRateLimiter, globalLimiter, authLimiter, userLimiter };
