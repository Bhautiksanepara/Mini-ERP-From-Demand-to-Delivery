const userModel = require('../models/user.model');
const auditLogModel = require('../models/audit-log.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { toPublicUser } = require('../utils/user-presenter');
const { buildFieldChangeLogs } = require('../utils/audit-diff');

const trackedFields = [
  'full_name',
  'address',
  'mobile_number',
  'position',
  'is_active'
];

const listUsers = asyncHandler(async (req, res) => {
  const users = await userModel.list(req.query || {});
  
  res.json({
    success: true,
    data: {
      users: users.map(toPublicUser)
    }
  });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await userModel.findByIdWithRoles(req.params.id);
  
  if (!user || user.deleted_at) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: {
      user: toPublicUser(user)
    }
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const loggedInUserId = req.user.id;
  const isAdmin = (req.user.roles || []).includes('admin');
  
  const before = await userModel.findByIdWithRoles(targetId);
  if (!before || before.deleted_at) {
    throw new AppError('User not found', 404);
  }

  const payload = { ...req.body };

  // Strict authorization check
  if (!isAdmin) {
    if (targetId !== loggedInUserId) {
      throw new AppError('You are not authorized to update another user\'s profile', 403);
    }
    
    const beforeRoles = (before.roles || []).map(r => r.code).sort().join(',');
    const payloadRoles = payload.role_codes ? [...payload.role_codes].sort().join(',') : beforeRoles;

    if (
      (payload.position !== undefined && payload.position !== before.position) ||
      (payload.is_active !== undefined && Boolean(payload.is_active) !== Boolean(before.is_active)) ||
      (payload.role_codes !== undefined && payloadRoles !== beforeRoles)
    ) {
      throw new AppError('You do not have permission to modify administrative fields (position, status, roles)', 403);
    }

    delete payload.position;
    delete payload.is_active;
    delete payload.role_codes;
  }

  // Handle profile photo conversion from base64 to LONGBLOB buffer
  if (payload.profile_photo !== undefined) {
    if (payload.profile_photo) {
      payload.profile_photo = Buffer.from(payload.profile_photo, 'base64');
    } else {
      payload.profile_photo = null;
    }
  }

  await userModel.update(targetId, payload);

  const after = await userModel.findByIdWithRoles(targetId);
  
  const logs = buildFieldChangeLogs({
    before,
    after,
    fields: trackedFields,
    baseLog: {
      user_id: loggedInUserId,
      module_code: 'user_management',
      record_type: 'User',
      record_id: targetId
    }
  });

  if (payload.role_codes) {
    const beforeRoles = (before.roles || []).map(r => r.code).sort().join(',');
    const afterRoles = (after.roles || []).map(r => r.code).sort().join(',');
    if (beforeRoles !== afterRoles) {
      logs.push({
        user_id: loggedInUserId,
        module_code: 'user_management',
        record_type: 'User',
        record_id: targetId,
        action: 'Updated',
        field_changed: 'roles',
        old_value: beforeRoles || 'None',
        new_value: afterRoles || 'None'
      });
    }
  }

  if (payload.profile_photo !== undefined) {
    logs.push({
      user_id: loggedInUserId,
      module_code: 'user_management',
      record_type: 'User',
      record_id: targetId,
      action: 'Updated',
      field_changed: 'profile_photo',
      old_value: before.profile_photo ? 'Photo Present' : 'No Photo',
      new_value: after.profile_photo ? 'Photo Present' : 'No Photo'
    });
  }

  await auditLogModel.createAuditLogs(logs);

  res.json({
    success: true,
    message: 'User profile updated successfully',
    data: {
      user: toPublicUser(after)
    }
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const loggedInUserId = req.user.id;
  const isAdmin = (req.user.roles || []).includes('admin');

  if (!isAdmin) {
    throw new AppError('Only System Administrators can delete users', 403);
  }

  if (targetId === loggedInUserId) {
    throw new AppError('You cannot delete your own account', 400);
  }

  const user = await userModel.findById(targetId);
  if (!user || user.deleted_at) {
    throw new AppError('User not found', 404);
  }

  await userModel.softDelete(targetId);

  await auditLogModel.createAuditLog({
    user_id: loggedInUserId,
    module_code: 'user_management',
    record_type: 'User',
    record_id: targetId,
    action: 'Deleted'
  });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

module.exports = {
  listUsers,
  getUser,
  updateUser,
  deleteUser
};
