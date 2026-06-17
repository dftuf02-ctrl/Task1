const TaskModel = require('../models/task.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

/**
 * Task Controller — handles HTTP request/response logic.
 * Delegates data access to the Task Model.
 */

/**
 * Whether the requesting user may access the given task.
 * Admins may access any task; regular users only their own.
 */
const canAccess = (user, task) => user.role === 'ADMIN' || task.user_id === user.id;

/**
 * POST /api/v1/tasks
 * Create a new task.
 */
const createTask = async (req, res, next) => {
  try {
    const { data, error } = await TaskModel.create(req.body, req.user.id);

    if (error) {
      logger.error('Failed to create task', { requestId: req.requestId, error: error.message });
      return sendError(res, 'Failed to create task', [], 500);
    }

    logger.info('Task created', { requestId: req.requestId, taskId: data.id, userId: req.user.id });
    return sendSuccess(res, data, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/tasks
 * Retrieve all tasks.
 */
const getAllTasks = async (req, res, next) => {
  try {
    const { data, error } = await TaskModel.findAll(req.user);

    if (error) {
      logger.error('Failed to fetch tasks', { requestId: req.requestId, error: error.message });
      return sendError(res, 'Failed to fetch tasks', [], 500);
    }

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/tasks/:id
 * Retrieve a single task by ID.
 */
const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidResult = TaskModel.uuidSchema.safeParse(id);
    if (!uuidResult.success) {
      return sendError(res, 'Invalid task ID format', [{ field: 'id', message: 'Must be a valid UUID' }], 400);
    }

    const { data, error } = await TaskModel.findById(id);

    if (error || !data) {
      return sendError(res, 'Task not found', [], 404);
    }

    // Hide other users' tasks behind a 404 so existence isn't leaked.
    if (!canAccess(req.user, data)) {
      return sendError(res, 'Task not found', [], 404);
    }

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/tasks/:id
 * Update an existing task.
 */
const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidResult = TaskModel.uuidSchema.safeParse(id);
    if (!uuidResult.success) {
      return sendError(res, 'Invalid task ID format', [{ field: 'id', message: 'Must be a valid UUID' }], 400);
    }

    // Check if task exists
    const { data: existing, error: findError } = await TaskModel.findById(id);
    if (findError || !existing) {
      return sendError(res, 'Task not found', [], 404);
    }

    if (!canAccess(req.user, existing)) {
      return sendError(res, 'Task not found', [], 404);
    }

    // Check if body has any update fields
    if (Object.keys(req.body).length === 0) {
      return sendError(res, 'No update fields provided', [], 400);
    }

    const { data, error } = await TaskModel.update(id, req.body);

    if (error) {
      logger.error('Failed to update task', { requestId: req.requestId, taskId: id, error: error.message });
      return sendError(res, 'Failed to update task', [], 500);
    }

    logger.info('Task updated', { requestId: req.requestId, taskId: id });
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/tasks/:id
 * Delete a task.
 */
const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidResult = TaskModel.uuidSchema.safeParse(id);
    if (!uuidResult.success) {
      return sendError(res, 'Invalid task ID format', [{ field: 'id', message: 'Must be a valid UUID' }], 400);
    }

    // Check if task exists
    const { data: existing, error: findError } = await TaskModel.findById(id);
    if (findError || !existing) {
      return sendError(res, 'Task not found', [], 404);
    }

    if (!canAccess(req.user, existing)) {
      return sendError(res, 'Task not found', [], 404);
    }

    const { error } = await TaskModel.remove(id);

    if (error) {
      logger.error('Failed to delete task', { requestId: req.requestId, taskId: id, error: error.message });
      return sendError(res, 'Failed to delete task', [], 500);
    }

    // Record the deletion in the activity log (best-effort:
    // a logging failure should not fail the delete itself).
    const logResult = await TaskModel.logDeletion(existing);
    if (logResult && logResult.error) {
      logger.warn('Failed to record task deletion in log', {
        requestId: req.requestId,
        taskId: id,
        error: logResult.error.message,
      });
    }

    logger.info('Task deleted', { requestId: req.requestId, taskId: id });
    return sendSuccess(res, { message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/tasks/deleted
 * Retrieve the task deletion log (most recently deleted first).
 */
const getDeletedTasks = async (req, res, next) => {
  try {
    const { data, error } = await TaskModel.findAllDeleted(req.user);

    if (error) {
      logger.error('Failed to fetch deletion log', { requestId: req.requestId, error: error.message });
      return sendError(res, 'Failed to fetch deletion log', [], 500);
    }

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getDeletedTasks,
};
