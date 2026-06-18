const reportController = require('../../src/controllers/report.controller');
const { enqueueReportJob, getReportQueue } = require('../../src/queue/reportQueue');

jest.mock('../../src/queue/reportQueue');

describe('Report Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
      requestId: 'test-request-id',
      user: { id: 'u1', email: 'u1@example.com', role: 'USER' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('requestReport', () => {
    it('enqueues a job and returns 202 with the job id and status url', async () => {
      enqueueReportJob.mockResolvedValue({ id: 'job-1' });

      await reportController.requestReport(mockReq, mockRes, mockNext);

      expect(enqueueReportJob).toHaveBeenCalledWith(
        { userId: 'u1', role: 'USER', email: 'u1@example.com', requestId: 'test-request-id' },
        { jobId: undefined },
      );
      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { jobId: 'job-1', status: 'queued', statusUrl: '/api/v1/reports/job-1' },
      });
    });

    it('scopes the Idempotency-Key job id to the user (no cross-user collision)', async () => {
      mockReq.headers['idempotency-key'] = 'abc-123';
      enqueueReportJob.mockResolvedValue({ id: 'report:u1:abc-123' });

      await reportController.requestReport(mockReq, mockRes, mockNext);

      expect(enqueueReportJob).toHaveBeenCalledWith(
        expect.any(Object),
        { jobId: 'report:u1:abc-123' },
      );
    });

    it('forwards errors to next', async () => {
      const err = new Error('redis down');
      enqueueReportJob.mockRejectedValue(err);

      await reportController.requestReport(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('getReportStatus', () => {
    const makeQueue = (job) => ({ getJob: jest.fn().mockResolvedValue(job) });

    it('returns 404 when the job does not exist', async () => {
      getReportQueue.mockReturnValue(makeQueue(null));
      mockReq.params.jobId = 'missing';

      await reportController.getReportStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when a regular user requests another user\'s job', async () => {
      const job = {
        id: 'job-1',
        data: { userId: 'someone-else' },
        getState: jest.fn().mockResolvedValue('active'),
        opts: { attempts: 3 },
        attemptsMade: 0,
      };
      getReportQueue.mockReturnValue(makeQueue(job));
      mockReq.params.jobId = 'job-1';

      await reportController.getReportStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns the report payload when completed', async () => {
      const report = { totals: { total: 2 } };
      const job = {
        id: 'job-1',
        data: { userId: 'u1' },
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: report,
        progress: 100,
        attemptsMade: 1,
        opts: { attempts: 3 },
      };
      getReportQueue.mockReturnValue(makeQueue(job));
      mockReq.params.jobId = 'job-1';

      await reportController.getReportStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          jobId: 'job-1',
          status: 'completed',
          progress: 100,
          attemptsMade: 1,
          maxAttempts: 3,
          report,
        },
      });
    });

    it('returns a generic error on failure and never leaks the raw reason', async () => {
      const job = {
        id: 'job-1',
        data: { userId: 'u1' },
        getState: jest.fn().mockResolvedValue('failed'),
        failedReason: 'SMTP down: connect ECONNREFUSED 10.0.0.5:587',
        progress: 70,
        attemptsMade: 3,
        opts: { attempts: 3 },
      };
      getReportQueue.mockReturnValue(makeQueue(job));
      mockReq.params.jobId = 'job-1';

      await reportController.getReportStatus(mockReq, mockRes, mockNext);

      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data.status).toBe('failed');
      expect(payload.data.error).toBe('Report generation failed. Please try again later.');
      // The raw internal reason must NOT be exposed to the client.
      expect(JSON.stringify(payload)).not.toContain('ECONNREFUSED');
    });

    it('lets an admin read any job', async () => {
      mockReq.user = { id: 'admin', role: 'ADMIN' };
      const job = {
        id: 'job-1',
        data: { userId: 'someone-else' },
        getState: jest.fn().mockResolvedValue('active'),
        progress: 10,
        attemptsMade: 0,
        opts: { attempts: 3 },
      };
      getReportQueue.mockReturnValue(makeQueue(job));
      mockReq.params.jobId = 'job-1';

      await reportController.getReportStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
