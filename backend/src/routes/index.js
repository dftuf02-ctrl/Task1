const { Router } = require('express');
const taskRoutes = require('./task.routes');
const authRoutes = require('./auth.routes');
const reportRoutes = require('./report.routes');
const healthRoutes = require('./health.routes');
const { getConfig } = require('../config/env');

const router = Router();
const { serviceRole } = getConfig();

// Role-based mounting — the same image serves different routes depending on
// which service it's deployed as. The NGINX Ingress routes /auth and /tasks
// to tasks-service and /reports to reports-service.
if (serviceRole === 'tasks' || serviceRole === 'all') {
  router.use('/api/v1/auth', authRoutes);
  router.use('/api/v1/tasks', taskRoutes);
}
if (serviceRole === 'reports' || serviceRole === 'all') {
  router.use('/api/v1/reports', reportRoutes);
}

// Health check (every role exposes it for k8s probes).
router.use('/health', healthRoutes);

module.exports = router;
