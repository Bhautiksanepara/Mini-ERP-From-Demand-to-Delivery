const auditLogModel = require('../models/audit-log.model');
const vendorModel = require('../models/vendor.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = ['name', 'address', 'email', 'mobile_number'];

const listVendors = asyncHandler(async (req, res) => {
  const vendors = await vendorModel.list(req.query || {});

  res.json({
    success: true,
    data: {
      vendors
    }
  });
});

const getVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorModel.findById(req.params.id);

  if (!vendor) {
    throw new AppError('Vendor not found', 404);
  }

  res.json({
    success: true,
    data: {
      vendor
    }
  });
});

const createVendor = asyncHandler(async (req, res) => {
  const vendorId = await vendorModel.create(req.body, req.user.id);
  const vendor = await vendorModel.findById(vendorId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'purchase',
    record_type: 'Vendor',
    record_id: vendorId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Vendor created successfully',
    data: {
      vendor
    }
  });
});

const updateVendor = asyncHandler(async (req, res) => {
  const before = await vendorModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Vendor not found', 404);
  }

  await vendorModel.update(req.params.id, req.body);

  const vendor = await vendorModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: vendor,
    fields: trackedFields,
    baseLog: {
      user_id: req.user.id,
      module_code: 'purchase',
      record_type: 'Vendor',
      record_id: req.params.id
    }
  });

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Vendor updated successfully',
    data: {
      vendor
    }
  });
});

const deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorModel.findById(req.params.id);

  if (!vendor) {
    throw new AppError('Vendor not found', 404);
  }

  await vendorModel.softDelete(req.params.id, req.user.id);
  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'purchase',
    record_type: 'Vendor',
    record_id: req.params.id,
    action: 'Deleted'
  });

  res.json({
    success: true,
    message: 'Vendor deleted successfully'
  });
});

module.exports = {
  createVendor,
  deleteVendor,
  getVendor,
  listVendors,
  updateVendor
};
