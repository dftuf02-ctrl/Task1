const { Router } = require('express');
const taskController = require('../controllers/task.controller');
const validate = require('../middleware/validate');
const { createTaskSchema, updateTaskSchema } = require('../models/task.model');

const router = Router();

router.post('/', validate(createTaskSchema), taskController.createTask);
router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', validate(updateTaskSchema), taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
