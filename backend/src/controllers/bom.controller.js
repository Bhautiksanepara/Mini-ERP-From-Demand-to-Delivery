const auditLogModel = require('../models/audit-log.model');
const bomModel = require('../models/bom.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = [
  'finished_product_id',
  'quantity',
  'unit',
  'component_count',
  'operation_count'
];

const listBoms = asyncHandler(async (req, res) => {
  const { rows, pagination, tab_counts } = await bomModel.list(req.query || {});

  res.json({
    success: true,
    data: {
      boms: rows
    },
    meta: {
      pagination,
      tab_counts
    }
  });
});

const getBom = asyncHandler(async (req, res) => {
  const bom = await bomModel.findById(req.params.id);

  if (!bom) {
    throw new AppError('Bill of Materials not found', 404);
  }

  res.json({
    success: true,
    data: {
      bom
    }
  });
});

const createBom = asyncHandler(async (req, res) => {
  const bomId = await bomModel.create(req.body, req.user.id);
  const bom = await bomModel.findById(bomId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'bom',
    record_type: 'Bill of Materials',
    record_id: bomId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Bill of Materials created successfully',
    data: {
      bom
    }
  });
});

const updateBom = asyncHandler(async (req, res) => {
  const before = await bomModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Bill of Materials not found', 404);
  }

  await bomModel.update(req.params.id, req.body);

  const bom = await bomModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: bom,
    fields: trackedFields,
    baseLog: {
      user_id: req.user.id,
      module_code: 'bom',
      record_type: 'Bill of Materials',
      record_id: req.params.id
    }
  });

  if (req.body.components) {
    logs.push({
      user_id: req.user.id,
      module_code: 'bom',
      record_type: 'Bill of Materials',
      record_id: req.params.id,
      action: 'Updated',
      field_changed: 'components',
      old_value: 'Previous components',
      new_value: 'Updated components'
    });
  }

  if (req.body.operations) {
    logs.push({
      user_id: req.user.id,
      module_code: 'bom',
      record_type: 'Bill of Materials',
      record_id: req.params.id,
      action: 'Updated',
      field_changed: 'operations',
      old_value: 'Previous operations',
      new_value: 'Updated operations'
    });
  }

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Bill of Materials updated successfully',
    data: {
      bom
    }
  });
});

const deleteBom = asyncHandler(async (req, res) => {
  const bom = await bomModel.findById(req.params.id);

  if (!bom) {
    throw new AppError('Bill of Materials not found', 404);
  }

  await bomModel.softDelete(req.params.id, req.user.id);
  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'bom',
    record_type: 'Bill of Materials',
    record_id: req.params.id,
    action: 'Deleted'
  });

  res.json({
    success: true,
    message: 'Bill of Materials deleted successfully'
  });
});

const listWorkCenters = asyncHandler(async (req, res) => {
  const workCenters = await bomModel.listWorkCenters(req.query || {});

  res.json({
    success: true,
    data: {
      work_centers: workCenters
    }
  });
});

const createWorkCenter = asyncHandler(async (req, res) => {
  const workCenterId = await bomModel.createWorkCenter(req.body);
  const workCenter = await bomModel.findWorkCenterById(workCenterId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'bom',
    record_type: 'Work Center',
    record_id: workCenterId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Work Center created successfully',
    data: {
      work_center: workCenter
    }
  });
});

module.exports = {
  createBom,
  createWorkCenter,
  deleteBom,
  getBom,
  listBoms,
  listWorkCenters,
  updateBom
};
