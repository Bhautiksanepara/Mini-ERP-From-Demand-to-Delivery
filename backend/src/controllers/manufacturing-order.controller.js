const auditLogModel = require('../models/audit-log.model');
const manufacturingOrderModel = require('../models/manufacturing-order.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = [
  'schedule_date',
  'finished_product_id',
  'quantity',
  'unit',
  'assignee_id',
  'bom_id',
  'status',
  'source_sales_order_id',
  'component_count',
  'work_order_count'
];

const listManufacturingOrders = asyncHandler(async (req, res) => {
  const manufacturingOrders = await manufacturingOrderModel.list({
    ...(req.query || {}),
    user_id: req.user.id
  });

  res.json({
    success: true,
    data: {
      manufacturing_orders: manufacturingOrders
    }
  });
});

const getManufacturingOrder = asyncHandler(async (req, res) => {
  const manufacturingOrder = await manufacturingOrderModel.findById(req.params.id);

  if (!manufacturingOrder) {
    throw new AppError('Manufacturing Order not found', 404);
  }

  res.json({
    success: true,
    data: {
      manufacturing_order: manufacturingOrder
    }
  });
});

const createManufacturingOrder = asyncHandler(async (req, res) => {
  const isAdmin = req.user.roles.includes('admin');
  const manufacturingOrderId = await manufacturingOrderModel.create(req.body, req.user.id, null, isAdmin);
  const manufacturingOrder = await manufacturingOrderModel.findById(manufacturingOrderId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'manufacturing',
    record_type: 'Manufacturing Order',
    record_id: manufacturingOrderId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Manufacturing Order created successfully',
    data: {
      manufacturing_order: manufacturingOrder
    }
  });
});

const updateManufacturingOrder = asyncHandler(async (req, res) => {
  const before = await manufacturingOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Manufacturing Order not found', 404);
  }

  const isAdmin = req.user.roles.includes('admin');
  await manufacturingOrderModel.update(req.params.id, req.body, isAdmin);

  const manufacturingOrder = await manufacturingOrderModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: manufacturingOrder,
    fields: trackedFields,
    baseLog: {
      user_id: req.user.id,
      module_code: 'manufacturing',
      record_type: 'Manufacturing Order',
      record_id: req.params.id
    }
  });

  if (req.body.components) {
    logs.push({
      user_id: req.user.id,
      module_code: 'manufacturing',
      record_type: 'Manufacturing Order',
      record_id: req.params.id,
      action: 'Updated',
      field_changed: 'components',
      old_value: 'Previous components',
      new_value: 'Updated components'
    });
  }

  if (req.body.work_orders) {
    logs.push({
      user_id: req.user.id,
      module_code: 'manufacturing',
      record_type: 'Manufacturing Order',
      record_id: req.params.id,
      action: 'Updated',
      field_changed: 'work_orders',
      old_value: 'Previous work orders',
      new_value: 'Updated work orders'
    });
  }

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Manufacturing Order updated successfully',
    data: {
      manufacturing_order: manufacturingOrder
    }
  });
});

const confirmManufacturingOrder = asyncHandler(async (req, res) => {
  const before = await manufacturingOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Manufacturing Order not found', 404);
  }

  await manufacturingOrderModel.confirm(req.params.id);

  const manufacturingOrder = await manufacturingOrderModel.findById(req.params.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'manufacturing',
    record_type: 'Manufacturing Order',
    record_id: req.params.id,
    action: 'Confirmed',
    field_changed: 'status',
    old_value: before.status,
    new_value: manufacturingOrder.status
  });

  res.json({
    success: true,
    message: 'Manufacturing Order confirmed successfully',
    data: {
      manufacturing_order: manufacturingOrder
    }
  });
});

const startManufacturingOrder = asyncHandler(async (req, res) => {
  const before = await manufacturingOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Manufacturing Order not found', 404);
  }

  await manufacturingOrderModel.start(req.params.id);

  const manufacturingOrder = await manufacturingOrderModel.findById(req.params.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'manufacturing',
    record_type: 'Manufacturing Order',
    record_id: req.params.id,
    action: 'Started',
    field_changed: 'status',
    old_value: before.status,
    new_value: manufacturingOrder.status
  });

  res.json({
    success: true,
    message: 'Manufacturing Order started successfully',
    data: {
      manufacturing_order: manufacturingOrder
    }
  });
});

const produceManufacturingOrder = asyncHandler(async (req, res) => {
  const before = await manufacturingOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Manufacturing Order not found', 404);
  }

  await manufacturingOrderModel.produce(req.params.id, req.body || {}, req.user.id);

  const manufacturingOrder = await manufacturingOrderModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: manufacturingOrder,
    fields: ['status'],
    baseLog: {
      user_id: req.user.id,
      module_code: 'manufacturing',
      record_type: 'Manufacturing Order',
      record_id: req.params.id
    }
  });

  logs.push({
    user_id: req.user.id,
    module_code: 'manufacturing',
    record_type: 'Manufacturing Order',
    record_id: req.params.id,
    action: 'Produced',
    field_changed: 'quantity',
    old_value: '0',
    new_value: manufacturingOrder.quantity
  });

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Manufacturing Order produced successfully',
    data: {
      manufacturing_order: manufacturingOrder
    }
  });
});

const cancelManufacturingOrder = asyncHandler(async (req, res) => {
  const before = await manufacturingOrderModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Manufacturing Order not found', 404);
  }

  await manufacturingOrderModel.cancel(req.params.id);

  const manufacturingOrder = await manufacturingOrderModel.findById(req.params.id);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'manufacturing',
    record_type: 'Manufacturing Order',
    record_id: req.params.id,
    action: 'Cancelled',
    field_changed: 'status',
    old_value: before.status,
    new_value: manufacturingOrder.status
  });

  res.json({
    success: true,
    message: 'Manufacturing Order cancelled successfully',
    data: {
      manufacturing_order: manufacturingOrder
    }
  });
});

const manufacturingOrderDashboardCounts = asyncHandler(async (req, res) => {
  const counts = await manufacturingOrderModel.listDashboardCounts(req.user.id);

  res.json({
    success: true,
    data: counts
  });
});

module.exports = {
  cancelManufacturingOrder,
  confirmManufacturingOrder,
  createManufacturingOrder,
  getManufacturingOrder,
  listManufacturingOrders,
  manufacturingOrderDashboardCounts,
  produceManufacturingOrder,
  startManufacturingOrder,
  updateManufacturingOrder
};
