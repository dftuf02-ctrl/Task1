const { Router } = require('express');
const taskRoutes = require('./task.routes');
const authRoutes = require('./auth.routes');
const reportRoutes = require('./report.routes');
const healthRoutes = require('./health.routes');

const router = Router();

// API v1 routes
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/tasks', taskRoutes);
router.use('/api/v1/reports', reportRoutes);

// Health check (outside versioned prefix)
router.use('/health', healthRoutes);

module.exports = router;
