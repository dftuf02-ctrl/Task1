const { z } = require('zod');
const { getSupabaseClient } = require('../config/supabase');

// ============================================================
// Validation Schemas (Zod)
// ============================================================

const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

const createTaskSchema = z.object({
  title: z
    .string({
      required_error: 'Title is required',
      invalid_type_error: 'Title must be a string',
    })
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be at most 255 characters')
    .trim(),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .trim()
    .nullable()
    .optional(),
  due_date: z
    .string()
    .datetime({ message: 'due_date must be a valid ISO 8601 date' })
    .nullable()
    .optional(),
  status: z
    .enum(TASK_STATUSES, {
      errorMap: () => ({
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}`,
      }),
    })
    .optional()
    .default('PENDING'),
});

const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be at most 255 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .trim()
    .nullable()
    .optional(),
  due_date: z
    .string()
    .datetime({ message: 'due_date must be a valid ISO 8601 date' })
    .nullable()
    .optional(),
  status: z
    .enum(TASK_STATUSES, {
      errorMap: () => ({
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}`,
      }),
    })
    .optional(),
});

// UUID validation for route parameters
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

// ============================================================
// Database Access Methods
// ============================================================

const TABLE_NAME = 'tasks';
const DELETED_TABLE_NAME = 'deleted_tasks';

/**
 * Fetch tasks ordered by creation date descending.
 * Admins see every task; regular users see only their own.
 * @param {{ id: string, role: string }} user
 * @returns {Promise<{ data: Array, error: object|null }>}
 */
const findAll = async (user) => {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (!user || user.role !== 'ADMIN') {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;
  return { data, error };
};

/**
 * Fetch a single task by UUID.
 * @param {string} id
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
const findById = async (id) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
};

/**
 * Create a new task owned by the given user.
 * @param {object} taskData
 * @param {string} userId - owner of the task
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
const create = async (taskData, userId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ ...taskData, user_id: userId })
    .select()
    .single();

  return { data, error };
};

/**
 * Update an existing task by UUID.
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
const update = async (id, updates) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

/**
 * Delete a task by UUID.
 * @param {string} id
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
const remove = async (id) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

/**
 * Record a deleted task into the deletion log.
 * @param {object} task - the task that was deleted
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
const logDeletion = async (task) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(DELETED_TABLE_NAME)
    .insert({
      task_id: task.id,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      due_date: task.due_date ?? null,
      user_id: task.user_id ?? null,
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Fetch the deletion log, most recently deleted first.
 * Admins see every entry; regular users see only their own.
 * @param {{ id: string, role: string }} user
 * @returns {Promise<{ data: Array, error: object|null }>}
 */
const findAllDeleted = async (user) => {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(DELETED_TABLE_NAME)
    .select('*')
    .order('deleted_at', { ascending: false });

  if (!user || user.role !== 'ADMIN') {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;
  return { data, error };
};

module.exports = {
  // Schemas
  createTaskSchema,
  updateTaskSchema,
  uuidSchema,
  TASK_STATUSES,
  // Database
  findAll,
  findById,
  create,
  update,
  remove,
  logDeletion,
  findAllDeleted,
};
