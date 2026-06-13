const express = require('express');

const bomController = require('../controllers/bom.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createBomSchema,
  createWorkCenterSchema,
  idParamSchema,
  listQuerySchema,
  updateBomSchema
} = require('../validators/bom.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/work-centers',
  requireModulePermission('bom', 'view', ['allowed', 'limited', 'optional']),
  validate(listQuerySchema),
  bomController.listWorkCenters
);
router.post(
  '/work-centers',
  requireModulePermission('bom', 'create'),
  validate(createWorkCenterSchema),
  bomController.createWorkCenter
);
router.get(
  '/',
  requireModulePermission('bom', 'view', ['allowed', 'limited', 'optional']),
  validate(listQuerySchema),
  bomController.listBoms
);
router.post(
  '/',
  requireModulePermission('bom', 'create'),
  validate(createBomSchema),
  bomController.createBom
);
router.get(
  '/:id',
  requireModulePermission('bom', 'view', ['allowed', 'limited', 'optional']),
  validate(idParamSchema),
  bomController.getBom
);
router.patch(
  '/:id',
  requireModulePermission('bom', 'edit', ['allowed', 'limited']),
  validate(updateBomSchema),
  bomController.updateBom
);
router.delete(
  '/:id',
  requireModulePermission('bom', 'delete'),
  validate(idParamSchema),
  bomController.deleteBom
);

module.exports = router;
