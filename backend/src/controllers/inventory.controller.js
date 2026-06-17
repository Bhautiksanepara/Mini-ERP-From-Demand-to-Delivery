const auditLogModel = require('../models/audit-log.model');
const inventoryModel = require('../models/inventory.model');
const { asyncHandler } = require('../utils/async-handler');

const listInventorySummary = asyncHandler(async (req, res) => {
  const summary = await inventoryModel.listInventorySummary(req.query || {});

  res.json({
    success: true,
    data: {
      inventory: summary
    }
  });
});

const listStockLedger = asyncHandler(async (req, res) => {
  const { rows, pagination, tab_counts } = await inventoryModel.listStockLedger(req.query || {});

  res.json({
    success: true,
    data: {
      stock_ledger: rows
    },
    meta: {
      pagination,
      tab_counts
    }
  });
});

const createManualAdjustment = asyncHandler(async (req, res) => {
  const adjustment = await inventoryModel.createManualAdjustment(req.body, req.user.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'product',
    record_type: 'Product',
    record_id: adjustment.product_id,
    action: 'Updated',
    field_changed: 'on_hand_qty',
    old_value: adjustment.previous_on_hand_qty,
    new_value: adjustment.on_hand_qty
  });

  res.status(201).json({
    success: true,
    message: 'Inventory adjusted successfully',
    data: {
      adjustment
    }
  });
});

module.exports = {
  createManualAdjustment,
  listInventorySummary,
  listStockLedger
};
