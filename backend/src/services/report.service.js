const TaskModel = require('../models/task.model');
const { getRedisClient } = require('../config/redis');
const { getConfig } = require('../config/env');
const { sendEmail } = require('./email.service');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Aggregate the caller's tasks into a summary report.
 *
 * Read-only and deterministic in shape: running it any number of times
 * produces an equivalent report, so it is safe to retry.
 *
 * @param {{ id: string, role: string }} user
 * @returns {Promise<object>} the report
 */
const buildReport = async (user) => {
  const { data: tasks, error } = await TaskModel.findAll(user);
  if (error) {
    // Throw so BullMQ marks the job failed and schedules a retry.
    throw new Error(`Failed to load tasks for report: ${error.message}`);
  }

  const rows = tasks || [];
  const now = Date.now();

  const byStatus = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  let overdue = 0;
  for (const task of rows) {
    if (byStatus[task.status] !== undefined) byStatus[task.status] += 1;
    if (task.due_date && task.status !== 'COMPLETED' && new Date(task.due_date).getTime() < now) {
      overdue += 1;
    }
  }

  const total = rows.length;
  const completionRate = total ? Math.round((byStatus.COMPLETED / total) * 100) : 0;

  return {
    scope: user.role === 'ADMIN' ? 'ALL_USERS' : 'OWN',
    generatedFor: { userId: user.id, role: user.role },
    totals: { total, ...byStatus, overdue },
    completionRate,
    generatedAt: new Date().toISOString(),
  };
};

/** Renders a plain-text email body from a report. */
const renderReportEmail = (report) => {
  const t = report.totals;
  return [
    'Your TaskFlow report is ready.',
    '',
    `Scope:           ${report.scope}`,
    `Total tasks:     ${t.total}`,
    `  Pending:       ${t.PENDING}`,
    `  In progress:   ${t.IN_PROGRESS}`,
    `  Completed:     ${t.COMPLETED}`,
    `  Overdue:       ${t.overdue}`,
    `Completion rate: ${report.completionRate}%`,
    `Generated at:    ${report.generatedAt}`,
  ].join('\n');
};

const emailGuardKey = (jobId) => `report:email-sent:${jobId}`;

/**
 * Idempotency guard for the (non-idempotent) email step. Atomically
 * claims the right to send the notification for this job using SET NX.
 *
 * @returns {Promise<boolean>} true if THIS call won the claim and should
 *   send; false if a previous run of the same job already sent it.
 */
const claimEmailSend = async (jobId) => {
  const redis = getRedisClient();
  const res = await redis.set(emailGuardKey(jobId), '1', 'EX', 24 * 3600, 'NX');
  return res === 'OK';
};

/** Releases the email claim so a retry can attempt the send again. */
const releaseEmailClaim = async (jobId) => {
  const redis = getRedisClient();
  await redis.del(emailGuardKey(jobId));
};

/**
 * Worker processor for a report job. Runs entirely in the worker
 * process — never on the API request path.
 *
 * Steps:
 *   1. Aggregate the tasks into a report (the "slow" part).
 *   2. Email the report as a notification — guarded so re-processing the
 *      same job (retry / at-least-once delivery) never sends twice.
 *
 * The returned report is persisted by BullMQ and surfaced to clients via
 * the status endpoint.
 *
 * @param {import('bullmq').Job} job
 * @returns {Promise<object>} the generated report
 */
const processReportJob = async (job) => {
  const config = getConfig();
  const { userId, role, email, requestId } = job.data;
  const user = { id: userId, role };

  await job.updateProgress(10);

  // (1) Heavy aggregation. A delay simulates a report that spans large
  // datasets / multiple tables, which is exactly why it must not block
  // the API request thread.
  if (config.reportProcessingDelayMs > 0) {
    await sleep(config.reportProcessingDelayMs);
  }

  // Optional fault injection to demonstrate retry + backoff in dev.
  if (config.reportFailRate > 0 && Math.random() < config.reportFailRate) {
    throw new Error('Injected transient failure (REPORT_FAIL_RATE)');
  }

  const report = await buildReport(user);
  await job.updateProgress(70);

  // (2) Notify by email — at most once per job.
  if (email) {
    const claimed = await claimEmailSend(job.id);
    if (claimed) {
      try {
        await sendEmail({
          to: email,
          subject: 'Your TaskFlow report is ready',
          text: renderReportEmail(report),
        });
      } catch (err) {
        // Release the claim so the retry can send the notification.
        await releaseEmailClaim(job.id);
        throw err;
      }
    } else {
      logger.info('Report email already sent for job — skipping (idempotent)', {
        jobId: job.id,
        requestId,
      });
    }
  }

  await job.updateProgress(100);
  return report;
};

module.exports = {
  buildReport,
  renderReportEmail,
  processReportJob,
  claimEmailSend,
  releaseEmailClaim,
};
