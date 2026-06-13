const express = require('express');

const auditLogController = require('../controllers/audit-log.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireModulePermission } = require('../middlewares/permission.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { listAuditLogsSchema } = require('../validators/audit-log.validator');

const router = express.Router();

router.use(authenticate);
router.use(requireModulePermission('audit_logs', 'view', ['allowed']));

router.get('/', validate(listAuditLogsSchema), auditLogController.listLogs);
router.get('/stats', validate(listAuditLogsSchema), auditLogController.getStats);

module.exports = router;
