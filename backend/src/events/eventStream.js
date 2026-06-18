const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Inter-service async messaging over Redis Streams.
 *
 * tasks-service PUBLISHES domain events (task.created / task.updated /
 * task.deleted) onto the stream; reports-service CONSUMES them via a
 * consumer group to maintain its own view — decoupled and at-least-once.
 */
const STREAM_KEY = 'taskflow:events';
const GROUP = 'reports-service';

/**
 * Publish a domain event. Fire-and-forget from the caller's perspective:
 * a streaming failure must never break the originating request, so errors
 * are logged, not thrown.
 *
 * @param {string} type    e.g. 'task.created'
 * @param {object} payload non-sensitive event body
 * @param {object} [meta]  { actorId, requestId }
 */
const publishEvent = async (type, payload, meta = {}) => {
  try {
    const redis = getRedisClient();
    const id = await redis.xadd(
      STREAM_KEY,
      'MAXLEN', '~', '10000', // bound the stream
      '*',
      'type', type,
      'payload', JSON.stringify(payload),
      'actorId', meta.actorId || '',
      'requestId', meta.requestId || '',
      'ts', new Date().toISOString(),
    );
    logger.info('Event published', { type, streamId: id });
    return id;
  } catch (err) {
    logger.error('Failed to publish event', { type, error: err.message });
    return null;
  }
};

/** Ensure the consumer group exists (idempotent). */
const ensureGroup = async (redis) => {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP, '$', 'MKSTREAM');
    logger.info('Consumer group created', { stream: STREAM_KEY, group: GROUP });
  } catch (err) {
    if (!String(err.message).includes('BUSYGROUP')) throw err; // already exists
  }
};

/**
 * Start the reports-service consumer loop. Reads new events for this
 * consumer, invokes the handler, and acks on success (at-least-once).
 *
 * @param {(event: object) => Promise<void>} handler
 * @param {{ consumerName?: string }} [opts]
 * @returns {{ stop: () => void }}
 */
const startConsumer = async (handler, opts = {}) => {
  const redis = getRedisClient();
  const consumer = opts.consumerName || `reports-${process.pid}`;
  await ensureGroup(redis);

  let running = true;
  const loop = async () => {
    while (running) {
      try {
        const res = await redis.xreadgroup(
          'GROUP', GROUP, consumer,
          'COUNT', 10,
          'BLOCK', 5000,
          'STREAMS', STREAM_KEY, '>',
        );
        if (!res) continue;
        for (const [, entries] of res) {
          for (const [id, fields] of entries) {
            const e = {};
            for (let i = 0; i < fields.length; i += 2) e[fields[i]] = fields[i + 1];
            try {
              await handler({
                streamId: id,
                type: e.type,
                payload: e.payload ? JSON.parse(e.payload) : null,
                actorId: e.actorId || null,
                requestId: e.requestId || null,
                ts: e.ts,
              });
              await redis.xack(STREAM_KEY, GROUP, id);
            } catch (err) {
              // Leave unacked so it's redelivered; surface for investigation.
              logger.error('Event handler failed', { streamId: id, type: e.type, error: err.message });
            }
          }
        }
      } catch (err) {
        if (running) logger.error('Consumer loop error', { error: err.message });
      }
    }
  };
  loop();

  logger.info('Event consumer started', { stream: STREAM_KEY, group: GROUP, consumer });
  return { stop: () => { running = false; } };
};

module.exports = { STREAM_KEY, GROUP, publishEvent, startConsumer };
