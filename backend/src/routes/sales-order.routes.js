const express = require('express');

const salesOrderController = require('../controllers/sales-order.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createSalesOrderSchema,
  deliverSalesOrderSchema,
  idParamSchema,
  listSalesOrdersSchema,
  updateSalesOrderSchema
} = require('../validators/sales-order.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requireModulePermission('sales', 'view', ['allowed', 'limited', 'optional']),
  validate(listSalesOrdersSchema),
  salesOrderController.listSalesOrders
);
router.get(
  '/dashboard-counts',
  requireModulePermission('sales', 'view', ['allowed', 'limited', 'optional']),
  salesOrderController.salesOrderDashboardCounts
);
router.post(
  '/',
  requireModulePermission('sales', 'create'),
  validate(createSalesOrderSchema),
  salesOrderController.createSalesOrder
);
router.get(
  '/:id',
  requireModulePermission('sales', 'view', ['allowed', 'limited', 'optional']),
  validate(idParamSchema),
  salesOrderController.getSalesOrder
);
router.patch(
  '/:id',
  requireModulePermission('sales', 'edit', ['allowed', 'limited']),
  validate(updateSalesOrderSchema),
  salesOrderController.updateSalesOrder
);
router.post(
  '/:id/confirm',
  requireModulePermission('sales', 'confirm', ['allowed']),
  validate(idParamSchema),
  salesOrderController.confirmSalesOrder
);
router.post(
  '/:id/deliver',
  requireModulePermission('sales', 'deliver', ['allowed', 'limited']),
  validate(deliverSalesOrderSchema),
  salesOrderController.deliverSalesOrder
);
router.post(
  '/:id/cancel',
  requireModulePermission('sales', 'edit', ['allowed', 'limited']),
  validate(idParamSchema),
  salesOrderController.cancelSalesOrder
);

module.exports = router;
