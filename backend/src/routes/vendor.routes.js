const express = require('express');

const vendorController = require('../controllers/vendor.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createVendorSchema,
  idParamSchema,
  listQuerySchema,
  updateVendorSchema
} = require('../validators/master-data.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requireModulePermission('purchase', 'view', ['allowed', 'limited', 'optional']),
  validate(listQuerySchema),
  vendorController.listVendors
);
router.post(
  '/',
  requireModulePermission('purchase', 'create'),
  validate(createVendorSchema),
  vendorController.createVendor
);
router.get(
  '/:id',
  requireModulePermission('purchase', 'view', ['allowed', 'limited', 'optional']),
  validate(idParamSchema),
  vendorController.getVendor
);
router.patch(
  '/:id',
  requireModulePermission('purchase', 'edit', ['allowed', 'limited']),
  validate(updateVendorSchema),
  vendorController.updateVendor
);
router.delete(
  '/:id',
  requireModulePermission('purchase', 'delete'),
  validate(idParamSchema),
  vendorController.deleteVendor
);

module.exports = router;
