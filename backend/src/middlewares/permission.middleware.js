const permissionModel = require('../models/permission.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');

const permissionRank = {
  denied: 0,
  optional: 1,
  limited: 2,
  allowed: 3
};

function hasAdminRole(req) {
  return (req.user.roles || []).includes('admin');
}

function resolveBestPermission(rows) {
  return rows.reduce((best, row) => {
    const currentRank = permissionRank[row.permission] || 0;
    const bestRank = permissionRank[best] || 0;

    return currentRank > bestRank ? row.permission : best;
  }, 'denied');
}

function requireModulePermission(moduleCode, actionCode, allowedPermissions = ['allowed']) {
  return asyncHandler(async (req, res, next) => {
    if (hasAdminRole(req)) {
      return next();
    }

    const roles = req.user.roles || [];
    const permissions = await permissionModel.getRoleModulePermissions(roles);
    const matchingPermissions = permissions.filter(
      (permission) =>
        permission.module_code === moduleCode &&
        permission.action_code === actionCode
    );
    const bestPermission = resolveBestPermission(matchingPermissions);

    if (!allowedPermissions.includes(bestPermission)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }

    req.permission = {
      module_code: moduleCode,
      action_code: actionCode,
      permission: bestPermission
    };

    return next();
  });
}

module.exports = {
  requireModulePermission
};
