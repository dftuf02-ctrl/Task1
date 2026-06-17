require('dotenv').config();
const { startReportWorker } = require('./src/workers/report.worker');
const { closeReportQueue } = require('./src/queue/reportQueue');
const { closeRedis } = require('./src/config/redis');
const logger = require('./src/utils/logger');

// Separate process from the API: it only consumes jobs from the queue.
const worker = startReportWorker();

// ── Graceful Shutdown ─────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down worker...`);
  try {
    // Stop picking up new jobs and let in-flight ones finish.
    await worker.close();
    await closeReportQueue();
    await closeRedis();
    logger.info('Worker closed. Process exiting.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during worker shutdown', { error: err.message });
    process.exit(1);
  }
};

// Force exit if a graceful shutdown hangs.
const forceExitAfter = (ms) => setTimeout(() => {
  logger.error('Graceful shutdown timed out. Forcing exit.');
  process.exit(1);
}, ms).unref();

process.on('SIGTERM', () => { forceExitAfter(10000); shutdown('SIGTERM'); });
process.on('SIGINT', () => { forceExitAfter(10000); shutdown('SIGINT'); });

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection in worker', { reason: (reason && reason.message) || reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception in worker', { error: error.message, stack: error.stack });
  process.exit(1);
});

module.exports = worker;
