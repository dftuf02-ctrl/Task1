const { Router } = require('express');
const taskRoutes = require('./task.routes');
const healthRoutes = require('./health.routes');

const router = Router();

// API v1 routes
router.use('/api/v1/tasks', taskRoutes);

// Health check (outside versioned prefix)
router.use('/health', healthRoutes);

module.exports = router;
