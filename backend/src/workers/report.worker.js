const { Worker } = require('bullmq');
const { createQueueConnection } = require('../queue/connection');
const { REPORT_QUEUE_NAME } = require('../queue/reportQueue');
const { processReportJob } = require('../services/report.service');
const { getConfig } = require('../config/env');
const { run } = require('../utils/requestContext');
const { reportJobsTotal, reportJobDuration } = require('../config/metrics');
const logger = require('../utils/logger');

/**
 * Wraps the job processor so that (a) the requestId carried on the job
 * propagates into every worker log line via AsyncLocalStorage, and
 * (b) processing time is recorded as a Prometheus histogram.
 */
const instrumentedProcessor = (job) =>
  run({ requestId: job.data && job.data.requestId }, async () => {
    const stopTimer = reportJobDuration.startTimer();
    try {
      return await processReportJob(job);
    } finally {
      stopTimer();
    }
  });

/**
 * Starts the BullMQ worker that drains the "reports" queue.
 *
 * This runs in its own process (see `backend/worker.js`), independent of
 * the API. Failed jobs are retried per the queue's backoff policy; the
 * worker just logs each outcome.
 *
 * @returns {import('bullmq').Worker}
 */
const startReportWorker = () => {
  const config = getConfig();

  const worker = new Worker(REPORT_QUEUE_NAME, instrumentedProcessor, {
    connection: createQueueConnection(),
    concurrency: config.reportConcurrency,
  });

  worker.on('completed', (job) => {
    reportJobsTotal.inc({ status: 'completed' });
    logger.info('Report job completed', { jobId: job.id, userId: job.data.userId });
  });

  worker.on('failed', (job, err) => {
    reportJobsTotal.inc({ status: 'failed' });
    const attemptsMade = job ? job.attemptsMade : 0;
    const maxAttempts = (job && job.opts && job.opts.attempts) || config.reportQueueAttempts;
    logger.error('Report job failed', {
      jobId: job && job.id,
      attemptsMade,
      maxAttempts,
      // BullMQ will retry automatically until attempts are exhausted.
      willRetry: attemptsMade < maxAttempts,
      error: err.message,
    });
  });

  worker.on('error', (err) => {
    logger.error('Report worker error', { error: err.message });
  });

  logger.info('Report worker started', {
    queue: REPORT_QUEUE_NAME,
    concurrency: config.reportConcurrency,
  });

  return worker;
};

module.exports = { startReportWorker };
