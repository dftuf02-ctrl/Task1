const taskController = require('../../src/controllers/task.controller');
const TaskModel = require('../../src/models/task.model');

jest.mock('../../src/models/task.model');
// The controller publishes domain events to Redis Streams; mock it so unit
// tests don't touch a real Redis.
jest.mock('../../src/events/eventStream', () => ({
  publishEvent: jest.fn().mockResolvedValue('0-1'),
}));

describe('Task Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      requestId: 'test-request-id',
      // Default to an admin so ownership checks pass; individual
      // tests override this to exercise per-user scoping.
      user: { id: 'owner-1', role: 'ADMIN' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task and return 201 status with the task data', async () => {
      const taskData = { title: 'New task', description: 'Desc', status: 'PENDING' };
      const createdTask = { id: 'uuid-123', ...taskData, created_at: 'now', updated_at: 'now' };

      mockReq.body = taskData;
      TaskModel.create.mockResolvedValue({ data: createdTask, error: null });

      await taskController.createTask(mockReq, mockRes, mockNext);

      expect(TaskModel.create).toHaveBeenCalledWith(taskData, 'owner-1');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdTask,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when the model returns a database error', async () => {
      mockReq.body = { title: 'New task' };
      TaskModel.create.mockResolvedValue({ data: null, error: { message: 'Database failure' } });

      await taskController.createTask(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to create task',
        errors: [],
      });
    });

    it('should call next on controller throws', async () => {
      const err = new Error('Unexpected error');
      TaskModel.create.mockRejectedValue(err);

      await taskController.createTask(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks with status 200', async () => {
      const tasks = [{ id: '1', title: 'Task 1' }, { id: '2', title: 'Task 2' }];
      TaskModel.findAll.mockResolvedValue({ data: tasks, error: null });

      await taskController.getAllTasks(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: tasks,
      });
    });

    it('should return 500 when model returns database error', async () => {
      TaskModel.findAll.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      await taskController.getAllTasks(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch tasks',
        errors: [],
      });
    });
  });

  describe('getTaskById', () => {
    const validUuid = 'c8b9dbe0-6f7f-4f01-a1e4-399bf07fa3c5';

    it('should return a task if found', async () => {
      const task = { id: validUuid, title: 'Found task' };
      mockReq.params.id = validUuid;
      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: task, error: null });

      await taskController.getTaskById(mockReq, mockRes, mockNext);

      expect(TaskModel.findById).toHaveBeenCalledWith(validUuid);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: task,
      });
    });

    it('should return 400 if ID is not a valid UUID', async () => {
      mockReq.params.id = 'invalid-uuid';
      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: false, error: {} });

      await taskController.getTaskById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid task ID format',
        errors: [{ field: 'id', message: 'Must be a valid UUID' }],
      });
      expect(TaskModel.findById).not.toHaveBeenCalled();
    });

    it('should return 404 if task is not found', async () => {
      mockReq.params.id = validUuid;
      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: null, error: null });

      await taskController.getTaskById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Task not found',
        errors: [],
      });
    });
  });

  describe('updateTask', () => {
    const validUuid = 'c8b9dbe0-6f7f-4f01-a1e4-399bf07fa3c5';

    it('should update task and return 200', async () => {
      const updates = { title: 'Updated title' };
      const updated = { id: validUuid, title: 'Updated title', status: 'PENDING' };

      mockReq.params.id = validUuid;
      mockReq.body = updates;

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: { id: validUuid, title: 'Old title' }, error: null });
      TaskModel.update.mockResolvedValue({ data: updated, error: null });

      await taskController.updateTask(mockReq, mockRes, mockNext);

      expect(TaskModel.update).toHaveBeenCalledWith(validUuid, updates);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updated,
      });
    });

    it('should return 400 if update body is empty', async () => {
      mockReq.params.id = validUuid;
      mockReq.body = {};

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: { id: validUuid, title: 'Old' }, error: null });

      await taskController.updateTask(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'No update fields provided',
        errors: [],
      });
    });
  });

  describe('deleteTask', () => {
    const validUuid = 'c8b9dbe0-6f7f-4f01-a1e4-399bf07fa3c5';

    it('should delete task and return 200', async () => {
      mockReq.params.id = validUuid;

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: { id: validUuid }, error: null });
      TaskModel.remove.mockResolvedValue({ error: null });

      await taskController.deleteTask(mockReq, mockRes, mockNext);

      expect(TaskModel.remove).toHaveBeenCalledWith(validUuid);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Task deleted successfully' },
      });
    });

    it('does NOT app-side log the deletion — logging is atomic in the DB trigger', async () => {
      mockReq.params.id = validUuid;

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: { id: validUuid }, error: null });
      TaskModel.remove.mockResolvedValue({ error: null });

      await taskController.deleteTask(mockReq, mockRes, mockNext);

      // The BEFORE DELETE trigger (migration 004) writes deleted_tasks in the
      // same transaction, so the controller must not do best-effort logging.
      expect(TaskModel.logDeletion).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('role-based ownership', () => {
    const validUuid = 'c8b9dbe0-6f7f-4f01-a1e4-399bf07fa3c5';

    it('getTaskById returns 404 when a regular user requests another user\'s task', async () => {
      mockReq.user = { id: 'user-A', role: 'USER' };
      mockReq.params.id = validUuid;

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: { id: validUuid, user_id: 'user-B' }, error: null });

      await taskController.getTaskById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('getTaskById succeeds when a regular user requests their own task', async () => {
      mockReq.user = { id: 'user-A', role: 'USER' };
      mockReq.params.id = validUuid;
      const task = { id: validUuid, user_id: 'user-A', title: 'Mine' };

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: task, error: null });

      await taskController.getTaskById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: task });
    });

    it('deleteTask returns 404 when a regular user deletes another user\'s task', async () => {
      mockReq.user = { id: 'user-A', role: 'USER' };
      mockReq.params.id = validUuid;

      TaskModel.uuidSchema.safeParse.mockReturnValue({ success: true, data: validUuid });
      TaskModel.findById.mockResolvedValue({ data: { id: validUuid, user_id: 'user-B' }, error: null });

      await taskController.deleteTask(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(TaskModel.remove).not.toHaveBeenCalled();
    });

    it('getAllTasks passes the requesting user to the model for scoping', async () => {
      mockReq.user = { id: 'user-A', role: 'USER' };
      TaskModel.findAll.mockResolvedValue({ data: [], error: null });

      await taskController.getAllTasks(mockReq, mockRes, mockNext);

      expect(TaskModel.findAll).toHaveBeenCalledWith({ id: 'user-A', role: 'USER' });
    });
  });

  describe('getDeletedTasks', () => {
    it('should return the deletion log with status 200', async () => {
      const log = [
        { id: 'l1', task_id: 't1', title: 'Gone task', status: 'PENDING', deleted_at: 'now' },
      ];
      TaskModel.findAllDeleted.mockResolvedValue({ data: log, error: null });

      await taskController.getDeletedTasks(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: log,
      });
    });

    it('should return 500 when the model returns a database error', async () => {
      TaskModel.findAllDeleted.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      await taskController.getDeletedTasks(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch deletion log',
        errors: [],
      });
    });
  });
});
