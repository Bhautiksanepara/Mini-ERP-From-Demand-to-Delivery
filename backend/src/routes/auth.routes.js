const express = require('express');

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { loginSchema, signupSchema } = require('../validators/auth.validator');

const router = express.Router();

router.post('/signup', validate(signupSchema), authController.signup);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
