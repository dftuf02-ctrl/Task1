const { testConnection } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * GET /health
 * Health check endpoint — reports API and database status.
 */
const getHealth = async (_req, res) => {
  try {
    const dbConnected = await testConnection();

    const health = {
      status: dbConnected ? 'UP' : 'DEGRADED',
      database: dbConnected ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    const statusCode = dbConnected ? 200 : 503;
    return sendSuccess(res, health, statusCode);
  } catch {
    return sendError(res, 'Health check failed', [], 503);
  }
};

module.exports = { getHealth };
