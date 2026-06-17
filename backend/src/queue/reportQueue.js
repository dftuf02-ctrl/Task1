const { Queue } = require('bullmq');
const { createQueueConnection } = require('./connection');
const { getConfig } = require('../config/env');

/**
 * The "reports" queue — the bridge between the API and the worker.
 *
 * The API only ever ENQUEUES onto this queue (and reads job status);
 * the heavy lifting happens in the separate worker process
 * (`backend/worker.js`). Jobs are persisted in Redis, so a job survives
 * an API or worker restart.
 */
const REPORT_QUEUE_NAME = 'reports';
const REPORT_JOB_NAME = 'generate-report';

let reportQueue = null;

const getReportQueue = () => {
  if (!reportQueue) {
    const config = getConfig();
    reportQueue = new Queue(REPORT_QUEUE_NAME, {
      connection: createQueueConnection(),
      defaultJobOptions: {
        // Retry failed jobs automatically with exponential backoff
        // (delays of ~2s, 4s, 8s … between attempts).
        attempts: config.reportQueueAttempts,
        backoff: { type: 'exponential', delay: 2000 },
        // Keep completed jobs around for an hour so clients can still
        // poll for the result, then evict them to bound Redis memory.
        removeOnComplete: { age: 3600, count: 500 },
        // Keep failures longer for inspection/debugging.
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }
  return reportQueue;
};

/**
 * Enqueue a report-generation job and return immediately.
 *
 * Passing a stable `jobId` makes enqueueing idempotent: BullMQ ignores a
 * second add with an id that already exists, so retrying the same logical
 * request (same Idempotency-Key) collapses onto the existing job instead
 * of spawning a duplicate.
 *
 * @param {object} payload - job data (who requested it, scope, recipient)
 * @param {{ jobId?: string }} [opts]
 * @returns {Promise<import('bullmq').Job>}
 */
const enqueueReportJob = async (payload, { jobId } = {}) => {
  const queue = getReportQueue();
  return queue.add(REPORT_JOB_NAME, payload, jobId ? { jobId } : {});
};

/**
 * Closes the queue connection (used on shutdown / in tests).
 */
const closeReportQueue = async () => {
  if (reportQueue) {
    await reportQueue.close();
    reportQueue = null;
  }
};

module.exports = {
  REPORT_QUEUE_NAME,
  REPORT_JOB_NAME,
  getReportQueue,
  enqueueReportJob,
  closeReportQueue,
};
