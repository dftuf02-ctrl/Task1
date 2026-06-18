const TaskModel = require('../models/task.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { audit, fromRequest } = require('../utils/audit');
const { publishEvent } = require('../events/eventStream');

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
    audit({
      action: 'task.create',
      result: 'SUCCESS',
      actor: { id: req.user.id, role: req.user.role },
      resource: { type: 'task', id: data.id },
      context: fromRequest(req),
    });
    await publishEvent('task.created', { id: data.id, status: data.status, user_id: data.user_id }, {
      actorId: req.user.id,
      requestId: req.requestId,
    });
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
      audit({
        action: 'authz.deny',
        result: 'FAILURE',
        actor: { id: req.user.id, role: req.user.role },
        resource: { type: 'task', id },
        context: fromRequest(req),
      });
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
    audit({
      action: 'task.update',
      result: 'SUCCESS',
      actor: { id: req.user.id, role: req.user.role },
      resource: { type: 'task', id },
      context: fromRequest(req),
    });
    await publishEvent('task.updated', { id, status: data.status, user_id: data.user_id }, {
      actorId: req.user.id,
      requestId: req.requestId,
    });
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
      audit({
        action: 'authz.deny',
        result: 'FAILURE',
        actor: { id: req.user.id, role: req.user.role },
        resource: { type: 'task', id },
        context: fromRequest(req),
      });
      return sendError(res, 'Task not found', [], 404);
    }

    // The delete and its activity-log entry are now atomic: a BEFORE DELETE
    // trigger (migration 004) writes the deleted_tasks row in the SAME
    // transaction, so they can never drift apart and a log failure rolls the
    // delete back. No best-effort app-side logging needed.
    const { error } = await TaskModel.remove(id);

    if (error) {
      logger.error('Failed to delete task', { requestId: req.requestId, taskId: id, error: error.message });
      return sendError(res, 'Failed to delete task', [], 500);
    }

    logger.info('Task deleted', { requestId: req.requestId, taskId: id });
    audit({
      action: 'task.delete',
      result: 'SUCCESS',
      actor: { id: req.user.id, role: req.user.role },
      resource: { type: 'task', id },
      context: fromRequest(req),
    });
    await publishEvent('task.deleted', { id, user_id: existing.user_id }, {
      actorId: req.user.id,
      requestId: req.requestId,
    });
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
