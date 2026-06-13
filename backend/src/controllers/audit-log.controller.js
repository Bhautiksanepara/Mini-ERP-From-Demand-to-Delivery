const auditLogModel = require('../models/audit-log.model');
const { asyncHandler } = require('../utils/async-handler');

const listLogs = asyncHandler(async (req, res) => {
  const logs = await auditLogModel.listAuditLogs(req.query || {});
  
  res.json({
    success: true,
    data: {
      audit_logs: logs
    }
  });
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await auditLogModel.getAuditLogStats(req.query || {});
  
  res.json({
    success: true,
    data: stats
  });
});

module.exports = {
  listLogs,
  getStats
};
