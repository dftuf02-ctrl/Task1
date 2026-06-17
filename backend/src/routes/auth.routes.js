const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimiter');
const { signupSchema, loginSchema, refreshSchema } = require('../models/user.model');

const router = Router();

// Stricter rate limit on credential endpoints to slow brute force.
const limiter = authLimiter();

router.post('/signup', limiter, validate(signupSchema), authController.signup);
router.post('/login', limiter, validate(loginSchema), authController.login);
router.post('/refresh', limiter, validate(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
