const express = require('express');

const permissionController = require('../controllers/permission.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/metadata', permissionController.listMetadata);
router.get('/me', permissionController.myPermissions);

module.exports = router;
