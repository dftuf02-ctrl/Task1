const os = require('os');

/**
 * Tags every response with the pod/host that served it via an `X-Pod-Name`
 * header. In Kubernetes `POD_NAME` is injected from the downward API (and
 * the container hostname equals the pod name anyway), which lets us prove
 * that requests load-balance across replicas.
 */
const POD_NAME = process.env.POD_NAME || os.hostname();

const podInfoMiddleware = (_req, res, next) => {
  res.setHeader('X-Pod-Name', POD_NAME);
  next();
};

module.exports = podInfoMiddleware;
