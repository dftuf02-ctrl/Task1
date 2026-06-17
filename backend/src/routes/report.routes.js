const { Router } = require('express');
const reportController = require('../controllers/report.controller');
const authenticate = require('../middleware/authenticate');
const { userLimiter } = require('../middleware/rateLimiter');

const router = Router();

// All report routes require authentication, then a per-user rate limit
// (counted by user id now that req.user is populated).
router.use(authenticate);
router.use(userLimiter());

// Enqueue a slow report job (returns 202 immediately).
router.post('/', reportController.requestReport);
// Poll job status / fetch the finished report.
router.get('/:jobId', reportController.getReportStatus);

module.exports = router;
