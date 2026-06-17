const auditLogModel = require('../models/audit-log.model');
const salesOrderModel = require('../models/sales-order.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = [
  'customer_id',
  'customer_address',
  'sales_person_id',
  'status',
  'scheduled_date',
  'total'
];

const listSalesOrders = asyncHandler(async (req, res) => {
  const { rows, pagination, tab_counts } = await salesOrderModel.list({
    ...(req.query || {}),
    user_id: req.user.id
  });

  res.json({
    success: true,
    data: {
      sales_orders: rows
    },
    meta: {
      pagination,
      tab_counts
    }
  });
});

const getSalesOrder = asyncHandler(async (req, res) => {
  const salesOrder = await salesOrderModel.findById(req.params.id);

  if (!salesOrder) {
    throw new AppError('Sales Order not found', 404);
  }

  res.json({
    success: true,
    data: {
      sales_order: salesOrder
    }
  });
});

const createSalesOrder = asyncHandler(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const salesOrderId = await salesOrderModel.create(req.body, req.user.id, isAdmin);
  const salesOrder = await salesOrderModel.findById(salesOrderId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'sales',
    record_type: 'Sales Order',
    record_id: salesOrderId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Sales Order created successfully',
    data: {
      sales_order: salesOrder
    }
  });
});

const updateSalesOrder = asyncHandler(async (req, res) => {
  const before = await salesOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Sales Order not found', 404);
  }

  const isAdmin = req.user.roles.includes('admin');
  await salesOrderModel.update(req.params.id, req.body, isAdmin, req.user.id);

  const salesOrder = await salesOrderModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: salesOrder,
    fields: trackedFields,
    baseLog: {
      user_id: req.user.id,
      module_code: 'sales',
      record_type: 'Sales Order',
      record_id: req.params.id
    }
  });

  if (req.body.items) {
    logs.push({
      user_id: req.user.id,
      module_code: 'sales',
      record_type: 'Sales Order',
      record_id: req.params.id,
      action: 'Updated',
      field_changed: 'items',
      old_value: 'Previous sales order lines',
      new_value: 'Updated sales order lines'
    });
  }

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Sales Order updated successfully',
    data: {
      sales_order: salesOrder
    }
  });
});

const confirmSalesOrder = asyncHandler(async (req, res) => {
  const before = await salesOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Sales Order not found', 404);
  }

  await salesOrderModel.confirm(req.params.id, req.user.id);

  const salesOrder = await salesOrderModel.findById(req.params.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'sales',
    record_type: 'Sales Order',
    record_id: req.params.id,
    action: 'Confirmed',
    field_changed: 'status',
    old_value: before.status,
    new_value: salesOrder.status
  });

  res.json({
    success: true,
    message: 'Sales Order confirmed successfully',
    data: {
      sales_order: salesOrder
    }
  });
});

const deliverSalesOrder = asyncHandler(async (req, res) => {
  const before = await salesOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Sales Order not found', 404);
  }

  await salesOrderModel.deliver(req.params.id, req.body, req.user.id);

  const salesOrder = await salesOrderModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: salesOrder,
    fields: ['status', 'total'],
    baseLog: {
      user_id: req.user.id,
      module_code: 'sales',
      record_type: 'Sales Order',
      record_id: req.params.id
    }
  });

  for (const item of req.body.items) {
    const oldItem = before.items.find((line) => Number(line.id) === Number(item.item_id));
    const newItem = salesOrder.items.find((line) => Number(line.id) === Number(item.item_id));

    if (oldItem && newItem && Number(oldItem.delivered_qty) !== Number(newItem.delivered_qty)) {
      logs.push({
        user_id: req.user.id,
        module_code: 'sales',
        record_type: 'Sales Order',
        record_id: req.params.id,
        action: 'Delivered',
        field_changed: `delivered_qty:${newItem.product_name}`,
        old_value: oldItem.delivered_qty,
        new_value: newItem.delivered_qty
      });
    }
  }

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Sales Order delivered successfully',
    data: {
      sales_order: salesOrder
    }
  });
});

const cancelSalesOrder = asyncHandler(async (req, res) => {
  const before = await salesOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Sales Order not found', 404);
  }

  await salesOrderModel.cancel(req.params.id);

  const salesOrder = await salesOrderModel.findById(req.params.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'sales',
    record_type: 'Sales Order',
    record_id: req.params.id,
    action: 'Cancelled',
    field_changed: 'status',
    old_value: before.status,
    new_value: salesOrder.status
  });

  res.json({
    success: true,
    message: 'Sales Order cancelled successfully',
    data: {
      sales_order: salesOrder
    }
  });
});

const salesOrderDashboardCounts = asyncHandler(async (req, res) => {
  const counts = await salesOrderModel.listDashboardCounts(req.user.id);

  res.json({
    success: true,
    data: counts
  });
});

const syncSalesOrderStatus = asyncHandler(async (req, res) => {
  const newStatus = await salesOrderModel.syncStatus(req.params.id);

  res.json({
    success: true,
    message: `Sales Order status synced to "${newStatus}"`,
    data: { status: newStatus }
  });
});

module.exports = {
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  deliverSalesOrder,
  getSalesOrder,
  listSalesOrders,
  salesOrderDashboardCounts,
  syncSalesOrderStatus,
  updateSalesOrder
};
