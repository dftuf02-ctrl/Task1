const IORedis = require('ioredis');
const { getConfig } = require('../config/env');

/**
 * Creates a dedicated ioredis connection for BullMQ.
 *
 * BullMQ uses blocking commands (e.g. BRPOPLPUSH) that monopolise the
 * connection, so the Queue and Worker each need their OWN connection
 * rather than sharing the app's rate-limiter client. BullMQ also
 * requires `maxRetriesPerRequest: null` on its connections.
 */
const createQueueConnection = () => {
  const config = getConfig();
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Keep retrying with a capped backoff so the worker/queue recover
    // automatically when Redis comes back.
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
};

module.exports = { createQueueConnection };
