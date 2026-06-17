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

/**
 * Fetch all tasks, ordered by creation date descending.
 * @returns {Promise<{ data: Array, error: object|null }>}
 */
const findAll = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

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
 * Create a new task.
 * @param {object} taskData
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
const create = async (taskData) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(taskData)
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
};
