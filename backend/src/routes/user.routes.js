const express = require('express');

const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  idParamSchema,
  listUsersSchema,
  updateUserSchema
} = require('../validators/user.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(listUsersSchema), userController.listUsers);
router.get('/:id', validate(idParamSchema), userController.getUser);
router.patch('/:id', validate(updateUserSchema), userController.updateUser);
router.delete('/:id', validate(idParamSchema), userController.deleteUser);

module.exports = router;
