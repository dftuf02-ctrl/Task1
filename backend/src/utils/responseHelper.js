/**
 * Standardized API response helpers.
 * Ensures every response follows the consistent format:
 *   Success: { success: true, data: {} }
 *   Error:   { success: false, message: "", errors: [] }
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {*} data - Response payload
 * @param {number} [statusCode=200]
 */
const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message - Human-readable error message
 * @param {Array} [errors=[]] - Detailed error list (e.g., validation errors)
 * @param {number} [statusCode=500]
 */
const sendError = (res, message, errors = [], statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { sendSuccess, sendError };
