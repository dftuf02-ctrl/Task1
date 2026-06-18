const winston = require('winston');
const { get } = require('./requestContext');

/**
 * Dedicated AUDIT logger — separate from the application logger.
 *
 * Defence requirement: every security-relevant action (authentication,
 * authorization decisions, and data mutations) produces a structured,
 * append-only audit record that answers WHO did WHAT to WHICH resource,
 * with WHAT result, from WHERE, and WHEN — correlated by request id.
 *
 * Records are emitted as single-line JSON on a dedicated stream so a log
 * shipper can route them to a write-once/append-only store (the records
 * are never mutated or deleted in-process). `category: "AUDIT"` and a
 * monotonic-ish ISO timestamp make them trivially filterable.
 */
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { category: 'AUDIT' },
  transports: [new winston.transports.Console()],
  // Audit is a hard requirement — never silence it, even under NODE_ENV=test
  // we keep it on so tests can assert audit emission.
});

/**
 * Emit an audit event.
 *
 * @param {object} e
 * @param {string} e.action   - e.g. 'auth.login', 'task.delete', 'authz.deny'
 * @param {'SUCCESS'|'FAILURE'} e.result
 * @param {object} [e.actor]  - { id, role, email } of the acting principal
 * @param {object} [e.resource] - { type, id } the action targeted
 * @param {object} [e.context]   - request-derived context (ip, method, path)
 * @param {object} [e.metadata]  - any extra non-sensitive detail
 */
const audit = ({ action, result, actor, resource, context, metadata }) => {
  const { requestId } = get();
  auditLogger.info('audit', {
    action,
    result,
    actor: actor || null,
    resource: resource || null,
    requestId: requestId || null,
    ...context,
    ...(metadata ? { metadata } : {}),
  });
};

/**
 * Convenience: derive audit context (ip / method / path) from an Express
 * request without leaking bodies or secrets.
 */
const fromRequest = (req) => ({
  ip: req.ip,
  method: req.method,
  path: req.originalUrl,
  userAgent: req.get && req.get('user-agent'),
});

module.exports = { audit, fromRequest, auditLogger };
