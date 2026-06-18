require('dotenv').config();

/**
 * Validated application configuration from environment variables.
 * Throws on missing required values — fail fast at startup.
 */
const getConfig = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  if (!process.env.SUPABASE_URL) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }

  // ── Supabase key selection ──────────────────────────────────
  // The BACKEND must use the SERVICE-ROLE key, never the anon (browser)
  // key: the anon key is meant to be paired with row-level security in the
  // browser, and with permissive RLS it would let anyone holding it
  // read/write the entire database. Service role is server-side only and
  // is required in production.
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  let supabaseKey = supabaseServiceRoleKey;
  if (!supabaseKey) {
    if (isProduction) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production — never run the backend on the anon key');
    }
    supabaseKey = supabaseAnonKey;
    if (supabaseKey) {
      // eslint-disable-next-line no-console
      console.warn(
        '[SECURITY] SUPABASE_SERVICE_ROLE_KEY not set — falling back to the anon key. ' +
          'This is INSECURE and must not be used outside local dev.',
      );
    }
  }
  if (!supabaseKey) {
    throw new Error('Missing Supabase credentials: set SUPABASE_SERVICE_ROLE_KEY');
  }

  // ── JWT secrets are REQUIRED in EVERY environment ───────────
  // No hardcoded public defaults — a leaked default secret lets anyone mint
  // valid tokens. Tests use fixed, clearly-marked test-only secrets.
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || (isTest ? 'test-only-access-secret' : undefined);
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || (isTest ? 'test-only-refresh-secret' : undefined);
  if (!jwtAccessSecret || !jwtRefreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required (set strong random values)');
  }

  // ── Trust proxy ─────────────────────────────────────────────
  // Behind an ingress / load balancer, Express must trust the proxy so
  // req.ip is the real client IP — otherwise the per-IP rate limiters all
  // bucket on the proxy address and brute-force protection is defeated.
  const rawTrust = process.env.TRUST_PROXY;
  let trustProxy;
  if (rawTrust === undefined) {
    trustProxy = isProduction ? 1 : false; // trust the first hop in prod
  } else if (/^\d+$/.test(rawTrust)) {
    trustProxy = parseInt(rawTrust, 10);
  } else if (rawTrust === 'true' || rawTrust === 'false') {
    trustProxy = rawTrust === 'true';
  } else {
    trustProxy = rawTrust; // e.g. 'loopback', a CIDR, etc.
  }

  return {
    port: parseInt(process.env.PORT, 10) || 3001,
    nodeEnv,
    isProduction,
    isTest,
    trustProxy,

    // Capstone: which service this process runs as. One image, two roles:
    //   'tasks'   → auth + tasks API, publishes domain events
    //   'reports' → reports API + Redis Streams consumer
    //   'all'     → everything in one process (local dev / tests)
    serviceRole: (process.env.SERVICE_ROLE || 'all').toLowerCase(),

    // Supabase — `supabaseKey` is what the server client uses (service role).
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey,
    supabaseServiceRoleKey,
    supabaseAnonKey,

    // CORS
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

    // JWT / Auth
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshExpiryDays: parseInt(process.env.REFRESH_EXPIRY_DAYS, 10) || 7,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
    // Password hashing implementation: 'bcryptjs' (pure-JS, blocks the event
    // loop — the load-test baseline) or 'native' (native bcrypt on the libuv
    // threadpool — the fix). Flip via PASSWORD_HASH to get before/after.
    passwordHashImpl: (process.env.PASSWORD_HASH || 'bcryptjs').toLowerCase(),

    // Redis (required for rate limiting and the report queue outside of tests)
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // Port the worker process serves its own /metrics endpoint on.
    workerMetricsPort: parseInt(process.env.WORKER_METRICS_PORT, 10) || 9101,

    // Background report queue / worker
    reportQueueAttempts: parseInt(process.env.REPORT_QUEUE_ATTEMPTS, 10) || 3,
    reportConcurrency: parseInt(process.env.REPORT_WORKER_CONCURRENCY, 10) || 2,
    reportProcessingDelayMs: parseInt(process.env.REPORT_PROCESSING_DELAY_MS, 10) || 3000,
    reportFailRate: parseFloat(process.env.REPORT_FAIL_RATE) || 0,

    // Email notifications (empty SMTP_URL => dev JSON transport, no delivery)
    smtpUrl: process.env.SMTP_URL || '',
    emailFrom: process.env.EMAIL_FROM || 'TaskFlow <no-reply@taskflow.local>',

    // Rate Limiting
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
  };
};

module.exports = { getConfig };
