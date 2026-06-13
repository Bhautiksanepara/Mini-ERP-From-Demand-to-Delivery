const permissionModel = require('../models/permission.model');
const { asyncHandler } = require('../utils/async-handler');

const listMetadata = asyncHandler(async (req, res) => {
  const [roles, modules, actions] = await Promise.all([
    permissionModel.listRoles(),
    permissionModel.listModules(),
    permissionModel.listActions()
  ]);

  res.json({
    success: true,
    data: {
      roles,
      modules,
      actions
    }
  });
});

const myPermissions = asyncHandler(async (req, res) => {
  const permissions = await permissionModel.getUserPermissionSnapshot(req.user.id);

  res.json({
    success: true,
    data: permissions
  });
});

module.exports = {
  listMetadata,
  myPermissions
};
