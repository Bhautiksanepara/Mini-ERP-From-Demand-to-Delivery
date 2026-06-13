const express = require('express');

const purchaseOrderController = require('../controllers/purchase-order.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createPurchaseOrderSchema,
  idParamSchema,
  listPurchaseOrdersSchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema
} = require('../validators/purchase-order.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requireModulePermission('purchase', 'view', ['allowed', 'limited', 'optional']),
  validate(listPurchaseOrdersSchema),
  purchaseOrderController.listPurchaseOrders
);
router.get(
  '/dashboard-counts',
  requireModulePermission('purchase', 'view', ['allowed', 'limited', 'optional']),
  purchaseOrderController.purchaseOrderDashboardCounts
);
router.post(
  '/',
  requireModulePermission('purchase', 'create'),
  validate(createPurchaseOrderSchema),
  purchaseOrderController.createPurchaseOrder
);
router.get(
  '/:id',
  requireModulePermission('purchase', 'view', ['allowed', 'limited', 'optional']),
  validate(idParamSchema),
  purchaseOrderController.getPurchaseOrder
);
router.patch(
  '/:id',
  requireModulePermission('purchase', 'edit', ['allowed', 'limited']),
  validate(updatePurchaseOrderSchema),
  purchaseOrderController.updatePurchaseOrder
);
router.post(
  '/:id/confirm',
  requireModulePermission('purchase', 'confirm', ['allowed']),
  validate(idParamSchema),
  purchaseOrderController.confirmPurchaseOrder
);
router.post(
  '/:id/receive',
  requireModulePermission('purchase', 'receive', ['allowed', 'limited']),
  validate(receivePurchaseOrderSchema),
  purchaseOrderController.receivePurchaseOrder
);
router.post(
  '/:id/cancel',
  requireModulePermission('purchase', 'edit', ['allowed', 'limited']),
  validate(idParamSchema),
  purchaseOrderController.cancelPurchaseOrder
);

module.exports = router;
