const Redis = require('ioredis');
const { getConfig } = require('./env');
const logger = require('../utils/logger');

let redisClient = null;
let redisHealthy = false;
let loggedDown = false;

/**
 * Returns the Redis client singleton (ioredis).
 * Lazily created on first access using REDIS_URL.
 *
 * Connection health is tracked so the rate limiter can fall back to
 * an in-memory store while Redis is unreachable, and automatically
 * resume using Redis once it reconnects.
 */
const getRedisClient = () => {
  if (!redisClient) {
    const config = getConfig();
    redisClient = new Redis(config.redisUrl, {
      // Keep retrying with a capped backoff so the app recovers
      // automatically when Redis comes back.
      retryStrategy: (times) => Math.min(times * 200, 5000),
      // null => never reject a command due to a retry limit; instead it
      // waits for reconnection. Combined with the offline queue this keeps
      // the store's one-time init commands pending (no unhandled rejection)
      // while Redis is down. We never issue per-request commands while
      // unhealthy because the limiter switches to the in-memory store.
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });

    redisClient.on('ready', () => {
      redisHealthy = true;
      loggedDown = false;
      logger.info('Redis connected', { url: config.redisUrl });
    });

    const markDown = () => {
      redisHealthy = false;
    };
    redisClient.on('end', markDown);
    redisClient.on('close', markDown);
    redisClient.on('reconnecting', markDown);

    redisClient.on('error', (err) => {
      redisHealthy = false;
      // Log the outage only once per down-period to avoid flooding logs.
      if (!loggedDown) {
        loggedDown = true;
        logger.warn('Redis unavailable — rate limiting will fall back to in-memory until it reconnects', {
          error: err.message,
        });
      }
    });
  }
  return redisClient;
};

/**
 * @returns {boolean} whether Redis is currently connected & usable.
 */
const isRedisHealthy = () => redisHealthy;

/**
 * Closes the Redis connection (used on shutdown / in tests).
 */
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisHealthy = false;
  }
};

module.exports = {
  getRedisClient,
  isRedisHealthy,
  closeRedis,
};
