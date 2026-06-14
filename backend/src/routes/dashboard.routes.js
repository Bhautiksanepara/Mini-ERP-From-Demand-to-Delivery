const express = require('express');

const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');

const router = express.Router();

router.use(authenticate);
router.use(requireModulePermission('dashboard', 'view', ['allowed']));

router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
