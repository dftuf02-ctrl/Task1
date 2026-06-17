const { sendError } = require('../utils/responseHelper');

/**
 * Creates a validation middleware from a Zod schema.
 * Validates req.body against the schema.
 * On failure, returns 400 with formatted validation errors.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {import('express').RequestHandler}
 */
const validate = (schema) => {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return sendError(_res, 'Validation failed', errors, 400);
    }

    // Replace body with parsed/transformed data (strips unknown fields)
    req.body = result.data;
    next();
  };
};

module.exports = validate;
