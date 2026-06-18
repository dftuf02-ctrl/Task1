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
    // Server-side client uses the SERVICE-ROLE key (config.supabaseKey),
    // which operates behind RLS. Anon access is locked down by the
    // restrictive RLS policies in migration 004.
    supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
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
