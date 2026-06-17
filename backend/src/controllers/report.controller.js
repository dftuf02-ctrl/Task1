const { enqueueReportJob, getReportQueue } = require('../queue/reportQueue');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

/**
 * Report Controller — enqueues the slow report job and reports status.
 * It never generates the report itself; that happens in the worker.
 */

/**
 * POST /api/v1/reports
 * Enqueue a report-generation + email-notification job and return 202
 * immediately. The actual work runs in the separate worker process.
 *
 * Idempotency: clients may send an `Idempotency-Key` header. Repeating a
 * request with the same key returns the existing job rather than queuing
 * a duplicate.
 */
const requestReport = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];

    const payload = {
      userId: req.user.id,
      role: req.user.role,
      email: req.user.email,
      requestId: req.requestId,
    };

    const job = await enqueueReportJob(payload, {
      jobId: idempotencyKey ? `report:${idempotencyKey}` : undefined,
    });

    logger.info('Report job enqueued', {
      requestId: req.requestId,
      jobId: job.id,
      userId: req.user.id,
    });

    return sendSuccess(
      res,
      {
        jobId: job.id,
        status: 'queued',
        statusUrl: `/api/v1/reports/${job.id}`,
      },
      202,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/:jobId
 * Poll a report job's status / result. A user may only read their own
 * jobs (admins may read any); unknown or unauthorized ids return 404 so
 * job existence isn't leaked.
 */
const getReportStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const queue = getReportQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return sendError(res, 'Report job not found', [], 404);
    }

    if (req.user.role !== 'ADMIN' && job.data.userId !== req.user.id) {
      return sendError(res, 'Report job not found', [], 404);
    }

    const state = await job.getState();
    const response = {
      jobId: job.id,
      status: state,
      progress: job.progress || 0,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    };

    if (state === 'completed') {
      response.report = job.returnvalue;
    } else if (state === 'failed') {
      response.error = job.failedReason;
    }

    return sendSuccess(res, response);
  } catch (err) {
    next(err);
  }
};

module.exports = { requestReport, getReportStatus };
