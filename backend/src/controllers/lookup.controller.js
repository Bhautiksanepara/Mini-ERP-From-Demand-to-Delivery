const bomModel = require('../models/bom.model');
const customerModel = require('../models/customer.model');
const productModel = require('../models/product.model');
const salesOrderModel = require('../models/sales-order.model');
const userModel = require('../models/user.model');
const vendorModel = require('../models/vendor.model');
const { asyncHandler } = require('../utils/async-handler');
const { toPublicUser } = require('../utils/user-presenter');

const limitDefaults = {
  limit: 200,
  offset: 0
};

function queryWithLimit(query = {}) {
  return {
    ...query,
    limit: query.limit || limitDefaults.limit,
    offset: query.offset || limitDefaults.offset
  };
}

const listCustomers = asyncHandler(async (req, res) => {
  const customers = await customerModel.list(queryWithLimit(req.query));

  res.json({
    success: true,
    data: { customers }
  });
});

const listVendors = asyncHandler(async (req, res) => {
  const vendors = await vendorModel.list(queryWithLimit(req.query));

  res.json({
    success: true,
    data: { vendors }
  });
});

const listProducts = asyncHandler(async (req, res) => {
  const products = await productModel.list(queryWithLimit(req.query));

  res.json({
    success: true,
    data: { products }
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const users = await userModel.list({
    ...queryWithLimit(req.query),
    is_active: req.query.is_active ?? 'true'
  });

  res.json({
    success: true,
    data: {
      users: users.map(toPublicUser)
    }
  });
});

const listBoms = asyncHandler(async (req, res) => {
  const boms = await bomModel.list(queryWithLimit(req.query));

  res.json({
    success: true,
    data: { boms }
  });
});

const listWorkCenters = asyncHandler(async (req, res) => {
  const workCenters = await bomModel.listWorkCenters(queryWithLimit(req.query));

  res.json({
    success: true,
    data: {
      work_centers: workCenters
    }
  });
});

const listSalesOrders = asyncHandler(async (req, res) => {
  const salesOrders = await salesOrderModel.list(queryWithLimit(req.query));

  res.json({
    success: true,
    data: {
      sales_orders: salesOrders
    }
  });
});

module.exports = {
  listBoms,
  listCustomers,
  listProducts,
  listSalesOrders,
  listUsers,
  listVendors,
  listWorkCenters
};
