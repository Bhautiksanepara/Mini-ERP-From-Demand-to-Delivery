const express = require('express');

const inventoryController = require('../controllers/inventory.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createManualAdjustmentSchema,
  listInventorySummarySchema,
  listStockLedgerSchema
} = require('../validators/inventory.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/summary',
  requireModulePermission('inventory', 'view', ['allowed', 'limited', 'optional']),
  validate(listInventorySummarySchema),
  inventoryController.listInventorySummary
);

router.get(
  '/stock-ledger',
  requireModulePermission('inventory', 'view', ['allowed', 'limited', 'optional']),
  validate(listStockLedgerSchema),
  inventoryController.listStockLedger
);

router.post(
  '/adjustments',
  requireModulePermission('product', 'edit', ['allowed', 'limited']),
  validate(createManualAdjustmentSchema),
  inventoryController.createManualAdjustment
);

module.exports = router;
