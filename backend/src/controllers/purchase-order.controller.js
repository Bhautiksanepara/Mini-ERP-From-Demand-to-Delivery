const auditLogModel = require('../models/audit-log.model');
const purchaseOrderModel = require('../models/purchase-order.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = [
  'vendor_id',
  'vendor_address',
  'responsible_user_id',
  'status',
  'scheduled_date',
  'source_sales_order_id',
  'total'
];

const listPurchaseOrders = asyncHandler(async (req, res) => {
  const purchaseOrders = await purchaseOrderModel.list({
    ...(req.query || {}),
    user_id: req.user.id
  });

  res.json({
    success: true,
    data: {
      purchase_orders: purchaseOrders
    }
  });
});

const getPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await purchaseOrderModel.findById(req.params.id);

  if (!purchaseOrder) {
    throw new AppError('Purchase Order not found', 404);
  }

  res.json({
    success: true,
    data: {
      purchase_order: purchaseOrder
    }
  });
});

const createPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrderId = await purchaseOrderModel.create(req.body, req.user.id);
  const purchaseOrder = await purchaseOrderModel.findById(purchaseOrderId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'purchase',
    record_type: 'Purchase Order',
    record_id: purchaseOrderId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Purchase Order created successfully',
    data: {
      purchase_order: purchaseOrder
    }
  });
});

const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const before = await purchaseOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Purchase Order not found', 404);
  }

  await purchaseOrderModel.update(req.params.id, req.body);

  const purchaseOrder = await purchaseOrderModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: purchaseOrder,
    fields: trackedFields,
    baseLog: {
      user_id: req.user.id,
      module_code: 'purchase',
      record_type: 'Purchase Order',
      record_id: req.params.id
    }
  });

  if (req.body.items) {
    logs.push({
      user_id: req.user.id,
      module_code: 'purchase',
      record_type: 'Purchase Order',
      record_id: req.params.id,
      action: 'Updated',
      field_changed: 'items',
      old_value: 'Previous purchase order lines',
      new_value: 'Updated purchase order lines'
    });
  }

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Purchase Order updated successfully',
    data: {
      purchase_order: purchaseOrder
    }
  });
});

const confirmPurchaseOrder = asyncHandler(async (req, res) => {
  const before = await purchaseOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Purchase Order not found', 404);
  }

  await purchaseOrderModel.confirm(req.params.id);

  const purchaseOrder = await purchaseOrderModel.findById(req.params.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'purchase',
    record_type: 'Purchase Order',
    record_id: req.params.id,
    action: 'Confirmed',
    field_changed: 'status',
    old_value: before.status,
    new_value: purchaseOrder.status
  });

  res.json({
    success: true,
    message: 'Purchase Order confirmed successfully',
    data: {
      purchase_order: purchaseOrder
    }
  });
});

const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const before = await purchaseOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Purchase Order not found', 404);
  }

  await purchaseOrderModel.receive(req.params.id, req.body, req.user.id);

  const purchaseOrder = await purchaseOrderModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: purchaseOrder,
    fields: ['status', 'total'],
    baseLog: {
      user_id: req.user.id,
      module_code: 'purchase',
      record_type: 'Purchase Order',
      record_id: req.params.id
    }
  });

  for (const item of req.body.items) {
    const oldItem = before.items.find((line) => Number(line.id) === Number(item.item_id));
    const newItem = purchaseOrder.items.find((line) => Number(line.id) === Number(item.item_id));

    if (oldItem && newItem && Number(oldItem.received_qty) !== Number(newItem.received_qty)) {
      logs.push({
        user_id: req.user.id,
        module_code: 'purchase',
        record_type: 'Purchase Order',
        record_id: req.params.id,
        action: 'Received',
        field_changed: `received_qty:${newItem.product_name}`,
        old_value: oldItem.received_qty,
        new_value: newItem.received_qty
      });
    }
  }

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Purchase Order received successfully',
    data: {
      purchase_order: purchaseOrder
    }
  });
});

const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const before = await purchaseOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Purchase Order not found', 404);
  }

  await purchaseOrderModel.cancel(req.params.id);

  const purchaseOrder = await purchaseOrderModel.findById(req.params.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'purchase',
    record_type: 'Purchase Order',
    record_id: req.params.id,
    action: 'Cancelled',
    field_changed: 'status',
    old_value: before.status,
    new_value: purchaseOrder.status
  });

  res.json({
    success: true,
    message: 'Purchase Order cancelled successfully',
    data: {
      purchase_order: purchaseOrder
    }
  });
});

const purchaseOrderDashboardCounts = asyncHandler(async (req, res) => {
  const counts = await purchaseOrderModel.listDashboardCounts(req.user.id);

  res.json({
    success: true,
    data: counts
  });
});

module.exports = {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  purchaseOrderDashboardCounts,
  receivePurchaseOrder,
  updatePurchaseOrder
};
