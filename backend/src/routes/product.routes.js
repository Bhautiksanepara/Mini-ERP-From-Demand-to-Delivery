const express = require('express');

const productController = require('../controllers/product.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createProductSchema,
  idParamSchema,
  listQuerySchema,
  updateProductSchema
} = require('../validators/master-data.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requireModulePermission('product', 'view', ['allowed', 'limited', 'optional']),
  validate(listQuerySchema),
  productController.listProducts
);
router.post(
  '/',
  requireModulePermission('product', 'create'),
  validate(createProductSchema),
  productController.createProduct
);
router.get(
  '/:id',
  requireModulePermission('product', 'view', ['allowed', 'limited', 'optional']),
  validate(idParamSchema),
  productController.getProduct
);
router.patch(
  '/:id',
  requireModulePermission('product', 'edit', ['allowed', 'limited']),
  validate(updateProductSchema),
  productController.updateProduct
);
router.delete(
  '/:id',
  requireModulePermission('product', 'delete'),
  validate(idParamSchema),
  productController.deleteProduct
);

module.exports = router;
