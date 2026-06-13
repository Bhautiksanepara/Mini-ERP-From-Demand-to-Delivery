const auditLogModel = require('../models/audit-log.model');
const customerModel = require('../models/customer.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = ['name', 'address', 'email', 'mobile_number'];

const listCustomers = asyncHandler(async (req, res) => {
  const customers = await customerModel.list(req.query || {});

  res.json({
    success: true,
    data: {
      customers
    }
  });
});

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.params.id);

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  res.json({
    success: true,
    data: {
      customer
    }
  });
});

const createCustomer = asyncHandler(async (req, res) => {
  const customerId = await customerModel.create(req.body, req.user.id);
  const customer = await customerModel.findById(customerId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'sales',
    record_type: 'Customer',
    record_id: customerId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Customer created successfully',
    data: {
      customer
    }
  });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const before = await customerModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Customer not found', 404);
  }

  await customerModel.update(req.params.id, req.body);

  const customer = await customerModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: customer,
    fields: trackedFields,
    baseLog: {
      user_id: req.user.id,
      module_code: 'sales',
      record_type: 'Customer',
      record_id: req.params.id
    }
  });

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Customer updated successfully',
    data: {
      customer
    }
  });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.params.id);

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  await customerModel.softDelete(req.params.id, req.user.id);
  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'sales',
    record_type: 'Customer',
    record_id: req.params.id,
    action: 'Deleted'
  });

  res.json({
    success: true,
    message: 'Customer deleted successfully'
  });
});

module.exports = {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer
};
