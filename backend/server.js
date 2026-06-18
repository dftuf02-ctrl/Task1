require('dotenv').config();
const createApp = require('./src/app');
const { getConfig } = require('./src/config/env');
const logger = require('./src/utils/logger');

const config = getConfig();
const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`, {
    serviceRole: config.serviceRole,
  });
});

// reports-service consumes task.* events off the Redis Stream. Started here
// (not in the worker) so the running service owns its async intake.
if (config.serviceRole === 'reports' || config.serviceRole === 'all') {
  const { startReportsConsumer } = require('./src/events/reportsConsumer');
  Promise.resolve(startReportsConsumer()).catch((err) =>
    logger.error('Failed to start reports consumer', { error: err.message }),
  );
}

// ── Graceful Shutdown ─────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }

    logger.info('Server closed. Process exiting.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

module.exports = server;
