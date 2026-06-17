const { createClient } = require('@supabase/supabase-js');
const { getConfig } = require('./env');

let supabaseClient = null;

/**
 * Returns the Supabase client singleton.
 * Lazily creates the client on first access.
 */
const getSupabaseClient = () => {
  if (!supabaseClient) {
    const config = getConfig();
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
};

/**
 * Tests database connectivity by running a simple query.
 * @returns {Promise<boolean>} true if connected
 */
const testConnection = async () => {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('tasks').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

/**
 * Resets the client singleton (used in testing).
 */
const resetClient = () => {
  supabaseClient = null;
};

module.exports = {
  getSupabaseClient,
  testConnection,
  resetClient,
};
