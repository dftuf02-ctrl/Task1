const { startConsumer } = require('./eventStream');
const logger = require('../utils/logger');
const { audit } = require('../utils/audit');

/**
 * reports-service event handler. Consumes task.* domain events published by
 * tasks-service over the Redis Stream. A real reports-service would update a
 * materialized view / aggregates here; we log + audit every consumed event
 * so the async path is observable and audit-covered end to end.
 */
const handleEvent = async (event) => {
  logger.info('reports-service consumed event', {
    type: event.type,
    streamId: event.streamId,
    requestId: event.requestId,
  });
  audit({
    action: 'event.consume',
    result: 'SUCCESS',
    actor: event.actorId ? { id: event.actorId } : null,
    resource: { type: 'event', id: event.streamId },
    context: { requestId: event.requestId },
    metadata: { eventType: event.type },
  });
};

const startReportsConsumer = () => startConsumer(handleEvent);

module.exports = { startReportsConsumer, handleEvent };
