const client = require('prom-client');

/**
 * Prometheus metrics registry (shared per-process).
 *
 * Both the API (server.js) and the worker (worker.js) require this module,
 * and since they run in separate processes each gets its own registry and
 * its own default Node.js metrics (event-loop lag, heap, GC, CPU…).
 */
const register = new client.Registry();

// Node.js runtime metrics — crucially `nodejs_eventloop_lag_seconds`, which
// is what exposes the bcrypt-on-the-event-loop bottleneck under load.
client.collectDefaultMetrics({ register });

// ── HTTP RED metrics (Rate, Errors, Duration) ────────────────
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── Background report-job metrics (worker process) ───────────
const reportJobsTotal = new client.Counter({
  name: 'report_jobs_total',
  help: 'Total report jobs processed by the worker, by outcome',
  labelNames: ['status'], // completed | failed
  registers: [register],
});

const reportJobDuration = new client.Histogram({
  name: 'report_job_duration_seconds',
  help: 'Time spent processing a report job in the worker',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

module.exports = {
  client,
  register,
  httpRequestDuration,
  httpRequestsTotal,
  reportJobsTotal,
  reportJobDuration,
};
