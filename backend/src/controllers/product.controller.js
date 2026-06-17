const auditLogModel = require('../models/audit-log.model');
const productModel = require('../models/product.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = [
  'name',
  'sales_price',
  'cost_price',
  'on_hand_qty',
  'procure_on_demand',
  'procurement_method',
  'vendor_id',
  'bom_id'
];

const listProducts = asyncHandler(async (req, res) => {
  const { rows, pagination, tab_counts } = await productModel.list(req.query || {});

  res.json({
    success: true,
    data: {
      products: rows
    },
    meta: {
      pagination,
      tab_counts
    }
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  res.json({
    success: true,
    data: {
      product
    }
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const productId = await productModel.create(req.body, req.user.id);
  const product = await productModel.findById(productId);

  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'product',
    record_type: 'Product',
    record_id: productId,
    action: 'Created'
  });

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: {
      product
    }
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const before = await productModel.findById(req.params.id);

  if (!before) {
    throw new AppError('Product not found', 404);
  }

  await productModel.update(req.params.id, req.body);

  const product = await productModel.findById(req.params.id);
  const logs = buildFieldChangeLogs({
    before,
    after: product,
    fields: trackedFields,
    baseLog: {
      user_id: req.user.id,
      module_code: 'product',
      record_type: 'Product',
      record_id: req.params.id
    }
  });

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: {
      product
    }
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  await productModel.softDelete(req.params.id, req.user.id);
  await auditLogModel.createAuditLog({
    user_id: req.user.id,
    module_code: 'product',
    record_type: 'Product',
    record_id: req.params.id,
    action: 'Deleted'
  });

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
});

module.exports = {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct
};
