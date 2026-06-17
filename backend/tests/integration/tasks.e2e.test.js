const request = require('supertest');
const createApp = require('../../src/app');
const TaskModel = require('../../src/models/task.model');
const { testConnection } = require('../../src/config/supabase');

// Mock task model database queries
jest.mock('../../src/models/task.model');
jest.mock('../../src/config/supabase');

describe('Task Management API E2E/Integration Tests', () => {
  let app;
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(() => {
    // Set required environment variables for test execution
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-key';
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should report status UP when database is reachable', async () => {
      testConnection.mockResolvedValue(true);

      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'UP',
          database: 'UP',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        }),
      });
    });

    it('should report status DEGRADED when database is unreachable', async () => {
      testConnection.mockResolvedValue(false);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'DEGRADED',
          database: 'DOWN',
        }),
      });
    });
  });

  describe('POST /api/v1/tasks', () => {
    it('should create a new task and return 201 with success payload', async () => {
      const payload = {
        title: 'Integration Test Task',
        description: 'Testing the whole stack flow',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        status: 'IN_PROGRESS',
      };

      const mockResponse = { id: validUuid, ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

      TaskModel.createTaskSchema.safeParse.mockReturnValue({ success: true, data: payload });
      TaskModel.create.mockResolvedValue({ data: mockResponse, error: null });

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(payload)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockResponse,
      });

      // Assert correlation request ID exists on response headers
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should return 400 when title validation fails', async () => {
      const payload = { description: 'Missing title' };

      // Make Zod validation fail
      TaskModel.createTaskSchema.safeParse.mockReturnValue({
        success: false,
        error: {
          issues: [{ path: ['title'], message: 'Title is required' }],
        },
      });

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(payload)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'title', message: 'Title is required' }],
      });
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('should return task collection', async () => {
      const collection = [
        { id: validUuid, title: 'Task 1', status: 'PENDING' },
        { id: '9f21b7a2-fa4c-487c-a49e-b9b68d6c70b8', title: 'Task 2', status: 'COMPLETED' },
      ];

      TaskModel.findAll.mockResolvedValue({ data: collection, error: null });

      const response = await request(app)
        .get('/api/v1/tasks')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: collection,
      });
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('should return single task details by ID', async () => {
      const task = { id: validUuid, title: 'Specific task' };

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: task, error: null });

      const response = await request(app)
        .get(`/api/v1/tasks/${validUuid}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: task,
      });
    });

    it('should return 404 for non-existent ID', async () => {
      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .get(`/api/v1/tasks/${validUuid}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Task not found',
        errors: [],
      });
    });

    it('should return 400 for bad UUID pattern format', async () => {
      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: false, error: {} });

      const response = await request(app)
        .get('/api/v1/tasks/not-a-valid-uuid')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid task ID format',
        errors: [{ field: 'id', message: 'Must be a valid UUID' }],
      });
    });
  });
});
