const { Router } = require('express');
const taskController = require('../controllers/task.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { userLimiter } = require('../middleware/rateLimiter');
const { createTaskSchema, updateTaskSchema } = require('../models/task.model');

const router = Router();

// All task routes require authentication, then enforce a per-user
// rate limit (counted by user id now that req.user is populated).
router.use(authenticate);
router.use(userLimiter());

router.post('/', validate(createTaskSchema), taskController.createTask);
router.get('/', taskController.getAllTasks);
// Must be registered before '/:id' so 'deleted' isn't captured as an id param.
router.get('/deleted', taskController.getDeletedTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', validate(updateTaskSchema), taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
