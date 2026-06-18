const { httpRequestDuration, httpRequestsTotal } = require('../config/metrics');

/**
 * Records Prometheus RED metrics for every HTTP request.
 *
 * IMPORTANT — label cardinality: we label by the Express route TEMPLATE
 * (e.g. `/api/v1/tasks/:id`), never `req.originalUrl`. Using the raw URL
 * would turn every task UUID into a distinct label value and blow up
 * Prometheus' time-series count.
 */
const metricsMiddleware = (req, res, next) => {
  const stopTimer = httpRequestDuration.startTimer();

  res.on('finish', () => {
    // req.route is only populated once a route has matched; fall back to a
    // low-cardinality placeholder for unmatched paths (404s, /metrics, etc.).
    const route = req.route
      ? `${req.baseUrl || ''}${req.route.path}`
      : req.path && req.path.startsWith('/api')
        ? 'unmatched_api'
        : req.path || 'unknown';

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    stopTimer(labels);
    httpRequestsTotal.inc(labels);
  });

  next();
};

module.exports = metricsMiddleware;
