const TaskModel = require('../../src/models/task.model');
const { getRedisClient } = require('../../src/config/redis');
const { getConfig } = require('../../src/config/env');
const { sendEmail } = require('../../src/services/email.service');
const {
  buildReport,
  renderReportEmail,
  processReportJob,
} = require('../../src/services/report.service');

jest.mock('../../src/models/task.model');
jest.mock('../../src/config/redis');
jest.mock('../../src/config/env');
jest.mock('../../src/services/email.service');

describe('Report Service', () => {
  let redis;

  beforeEach(() => {
    jest.clearAllMocks();
    redis = { set: jest.fn(), del: jest.fn() };
    getRedisClient.mockReturnValue(redis);
    // No artificial delay / no fault injection in tests.
    getConfig.mockReturnValue({ reportProcessingDelayMs: 0, reportFailRate: 0 });
  });

  describe('buildReport', () => {
    it('aggregates tasks into status counts, overdue, and completion rate', async () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const future = new Date(Date.now() + 86400000).toISOString();
      TaskModel.findAll.mockResolvedValue({
        data: [
          { status: 'PENDING', due_date: past },        // overdue
          { status: 'IN_PROGRESS', due_date: future },
          { status: 'COMPLETED', due_date: past },       // completed => not overdue
          { status: 'COMPLETED', due_date: null },
        ],
        error: null,
      });

      const report = await buildReport({ id: 'u1', role: 'USER' });

      expect(TaskModel.findAll).toHaveBeenCalledWith({ id: 'u1', role: 'USER' });
      expect(report.scope).toBe('OWN');
      expect(report.totals).toEqual({
        total: 4,
        PENDING: 1,
        IN_PROGRESS: 1,
        COMPLETED: 2,
        overdue: 1,
      });
      expect(report.completionRate).toBe(50);
    });

    it('marks scope ALL_USERS for admins and handles an empty task list', async () => {
      TaskModel.findAll.mockResolvedValue({ data: [], error: null });

      const report = await buildReport({ id: 'admin', role: 'ADMIN' });

      expect(report.scope).toBe('ALL_USERS');
      expect(report.totals.total).toBe(0);
      expect(report.completionRate).toBe(0);
    });

    it('throws (so the job fails and retries) when the data load errors', async () => {
      TaskModel.findAll.mockResolvedValue({ data: null, error: { message: 'DB down' } });

      await expect(buildReport({ id: 'u1', role: 'USER' })).rejects.toThrow('DB down');
    });
  });

  describe('renderReportEmail', () => {
    it('includes the headline totals', () => {
      const body = renderReportEmail({
        scope: 'OWN',
        totals: { total: 3, PENDING: 1, IN_PROGRESS: 1, COMPLETED: 1, overdue: 0 },
        completionRate: 33,
        generatedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(body).toContain('Total tasks:     3');
      expect(body).toContain('Completion rate: 33%');
    });
  });

  describe('processReportJob (idempotent email)', () => {
    const makeJob = () => ({
      id: 'job-1',
      data: { userId: 'u1', role: 'USER', email: 'u1@example.com', requestId: 'req-1' },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    });

    beforeEach(() => {
      TaskModel.findAll.mockResolvedValue({ data: [], error: null });
    });

    it('sends the email and returns the report when it wins the claim', async () => {
      redis.set.mockResolvedValue('OK'); // claim acquired
      sendEmail.mockResolvedValue({ messageId: 'm1' });

      const report = await processReportJob(makeJob());

      expect(redis.set).toHaveBeenCalledWith('report:email-sent:job-1', '1', 'EX', 86400, 'NX');
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(report.totals.total).toBe(0);
    });

    it('does NOT send again when the claim is already held (re-processing)', async () => {
      redis.set.mockResolvedValue(null); // claim already taken => already sent

      await processReportJob(makeJob());

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('releases the claim and rethrows when sending fails (so a retry can resend)', async () => {
      redis.set.mockResolvedValue('OK');
      sendEmail.mockRejectedValue(new Error('SMTP down'));

      await expect(processReportJob(makeJob())).rejects.toThrow('SMTP down');
      expect(redis.del).toHaveBeenCalledWith('report:email-sent:job-1');
    });
  });
});
