require('dotenv').config();

/**
 * Validated application configuration from environment variables.
 * Throws on missing required values — fail fast at startup.
 */
const getConfig = () => {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // Default JWT secrets are only acceptable outside production.
  const DEV_ACCESS_SECRET = 'dev-access-secret-change-me';
  const DEV_REFRESH_SECRET = 'dev-refresh-secret-change-me';
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || DEV_REFRESH_SECRET;

  if (isProduction && (jwtAccessSecret === DEV_ACCESS_SECRET || jwtRefreshSecret === DEV_REFRESH_SECRET)) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production');
  }

  return {
    port: parseInt(process.env.PORT, 10) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction,
    isTest: process.env.NODE_ENV === 'test',

    // Supabase
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,

    // CORS
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

    // JWT / Auth
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshExpiryDays: parseInt(process.env.REFRESH_EXPIRY_DAYS, 10) || 7,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,

    // Redis (required for rate limiting and the report queue outside of tests)
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

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
