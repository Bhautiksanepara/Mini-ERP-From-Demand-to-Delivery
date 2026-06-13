const express = require('express');

const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createCustomerSchema,
  idParamSchema,
  listQuerySchema,
  updateCustomerSchema
} = require('../validators/master-data.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requireModulePermission('sales', 'view', ['allowed', 'limited', 'optional']),
  validate(listQuerySchema),
  customerController.listCustomers
);
router.post(
  '/',
  requireModulePermission('sales', 'create'),
  validate(createCustomerSchema),
  customerController.createCustomer
);
router.get(
  '/:id',
  requireModulePermission('sales', 'view', ['allowed', 'limited', 'optional']),
  validate(idParamSchema),
  customerController.getCustomer
);
router.patch(
  '/:id',
  requireModulePermission('sales', 'edit', ['allowed', 'limited']),
  validate(updateCustomerSchema),
  customerController.updateCustomer
);
router.delete(
  '/:id',
  requireModulePermission('sales', 'delete'),
  validate(idParamSchema),
  customerController.deleteCustomer
);

module.exports = router;
