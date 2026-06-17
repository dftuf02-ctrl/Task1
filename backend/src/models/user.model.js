const { z } = require('zod');
const { getSupabaseClient } = require('../config/supabase');

// ============================================================
// Validation Schemas (Zod)
// ============================================================

const USER_ROLES = ['USER', 'ADMIN'];

const signupSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Must be a valid email address')
    .max(255, 'Email must be at most 255 characters')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  // Role is optional; defaults to USER. Self-assigning ADMIN is
  // rejected at the controller layer.
  role: z
    .enum(USER_ROLES, {
      errorMap: () => ({ message: `Role must be one of: ${USER_ROLES.join(', ')}` }),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Must be a valid email address')
    .trim()
    .toLowerCase(),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'refreshToken is required' }).min(1, 'refreshToken is required'),
});

// ============================================================
// Database Access — users
// ============================================================

const USERS_TABLE = 'users';
const REFRESH_TABLE = 'refresh_tokens';

const findByEmail = async (email) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .eq('email', email)
    .maybeSingle();

  return { data, error };
};

const findById = async (id) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('id, email, role, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  return { data, error };
};

const createUser = async ({ email, password_hash, role = 'USER' }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .insert({ email, password_hash, role })
    .select('id, email, role, created_at, updated_at')
    .single();

  return { data, error };
};

// ============================================================
// Database Access — refresh tokens
// ============================================================

const storeRefreshToken = async ({ user_id, token_hash, expires_at }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(REFRESH_TABLE)
    .insert({ user_id, token_hash, expires_at })
    .select()
    .single();

  return { data, error };
};

const findRefreshToken = async (token_hash) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(REFRESH_TABLE)
    .select('*')
    .eq('token_hash', token_hash)
    .maybeSingle();

  return { data, error };
};

const revokeRefreshToken = async (token_hash) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(REFRESH_TABLE)
    .update({ revoked: true })
    .eq('token_hash', token_hash)
    .select()
    .maybeSingle();

  return { data, error };
};

const revokeAllForUser = async (user_id) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(REFRESH_TABLE)
    .update({ revoked: true })
    .eq('user_id', user_id);

  return { error };
};

module.exports = {
  // Schemas
  signupSchema,
  loginSchema,
  refreshSchema,
  USER_ROLES,
  // Users
  findByEmail,
  findById,
  createUser,
  // Refresh tokens
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
