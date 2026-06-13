const express = require('express');

const manufacturingOrderController = require('../controllers/manufacturing-order.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createManufacturingOrderSchema,
  idParamSchema,
  listManufacturingOrdersSchema,
  produceManufacturingOrderSchema,
  updateManufacturingOrderSchema
} = require('../validators/manufacturing-order.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requireModulePermission('manufacturing', 'view', ['allowed', 'limited', 'optional']),
  validate(listManufacturingOrdersSchema),
  manufacturingOrderController.listManufacturingOrders
);
router.get(
  '/dashboard-counts',
  requireModulePermission('manufacturing', 'view', ['allowed', 'limited', 'optional']),
  manufacturingOrderController.manufacturingOrderDashboardCounts
);
router.post(
  '/',
  requireModulePermission('manufacturing', 'create'),
  validate(createManufacturingOrderSchema),
  manufacturingOrderController.createManufacturingOrder
);
router.get(
  '/:id',
  requireModulePermission('manufacturing', 'view', ['allowed', 'limited', 'optional']),
  validate(idParamSchema),
  manufacturingOrderController.getManufacturingOrder
);
router.patch(
  '/:id',
  requireModulePermission('manufacturing', 'edit', ['allowed', 'limited']),
  validate(updateManufacturingOrderSchema),
  manufacturingOrderController.updateManufacturingOrder
);
router.post(
  '/:id/confirm',
  requireModulePermission('manufacturing', 'confirm', ['allowed']),
  validate(idParamSchema),
  manufacturingOrderController.confirmManufacturingOrder
);
router.post(
  '/:id/start',
  requireModulePermission('manufacturing', 'production_entry', ['allowed', 'limited']),
  validate(idParamSchema),
  manufacturingOrderController.startManufacturingOrder
);
router.post(
  '/:id/produce',
  requireModulePermission('manufacturing', 'production_entry', ['allowed', 'limited']),
  validate(produceManufacturingOrderSchema),
  manufacturingOrderController.produceManufacturingOrder
);
router.post(
  '/:id/cancel',
  requireModulePermission('manufacturing', 'edit', ['allowed', 'limited']),
  validate(idParamSchema),
  manufacturingOrderController.cancelManufacturingOrder
);

module.exports = router;
