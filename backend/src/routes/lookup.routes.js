const express = require('express');

const lookupController = require('../controllers/lookup.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/customers', lookupController.listCustomers);
router.get('/vendors', lookupController.listVendors);
router.get('/products', lookupController.listProducts);
router.get('/users', lookupController.listUsers);
router.get('/boms', lookupController.listBoms);
router.get('/work-centers', lookupController.listWorkCenters);
router.get('/sales-orders', lookupController.listSalesOrders);

module.exports = router;
