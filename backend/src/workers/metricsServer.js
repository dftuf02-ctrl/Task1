const http = require('http');
const { register } = require('../config/metrics');
const { getConfig } = require('../config/env');
const logger = require('../utils/logger');

/**
 * The worker runs in its own process, so it exposes its own `/metrics`
 * endpoint on a dedicated port for Prometheus to scrape (the API's metrics
 * live on the API port). Tiny bare-`http` server — no need to pull Express
 * into the worker.
 *
 * @returns {import('http').Server}
 */
const startMetricsServer = () => {
  const { workerMetricsPort } = getConfig();

  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (err) {
        res.statusCode = 500;
        res.end(err.message);
      }
      return;
    }
    if (req.url === '/health') {
      res.end('ok');
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });

  server.listen(workerMetricsPort, () => {
    logger.info('Worker metrics server listening', { port: workerMetricsPort });
  });

  return server;
};

module.exports = { startMetricsServer };
