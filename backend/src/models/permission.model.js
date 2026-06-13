const { pool } = require('../config/database');

async function listRoles() {
  const [rows] = await pool.execute(
    `SELECT id, name, code, description, is_system_role
     FROM roles
     WHERE deleted_at IS NULL
     ORDER BY is_system_role DESC, name`
  );

  return rows;
}

async function listModules() {
  const [rows] = await pool.execute(
    `SELECT id, name, code
     FROM modules
     ORDER BY name`
  );

  return rows;
}

async function listActions() {
  const [rows] = await pool.execute(
    `SELECT id, name, code
     FROM actions
     ORDER BY name`
  );

  return rows;
}

async function getRoleModulePermissions(roleCodes = []) {
  if (!roleCodes.length) {
    return [];
  }

  const placeholders = roleCodes.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT
      r.code AS role_code,
      m.code AS module_code,
      a.code AS action_code,
      mp.permission
     FROM module_permissions mp
     INNER JOIN roles r ON r.id = mp.role_id
     INNER JOIN modules m ON m.id = mp.module_id
     INNER JOIN actions a ON a.id = mp.action_id
     WHERE r.code IN (${placeholders})
       AND r.deleted_at IS NULL
     ORDER BY m.name, a.name, r.name`,
    roleCodes
  );

  return rows;
}

async function getRoleFieldPermissions(roleCodes = []) {
  if (!roleCodes.length) {
    return [];
  }

  const placeholders = roleCodes.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT
      r.code AS role_code,
      m.code AS module_code,
      f.code AS field_code,
      f.name AS field_name,
      f.is_system_computed,
      fp.can_create,
      fp.can_view,
      fp.can_edit,
      fp.can_delete
     FROM field_permissions fp
     INNER JOIN roles r ON r.id = fp.role_id
     INNER JOIN fields f ON f.id = fp.field_id
     INNER JOIN modules m ON m.id = f.module_id
     WHERE r.code IN (${placeholders})
       AND r.deleted_at IS NULL
     ORDER BY m.name, f.name, r.name`,
    roleCodes
  );

  return rows;
}

async function getUserPermissionSnapshot(userId) {
  const [roles] = await pool.execute(
    `SELECT r.id, r.name, r.code
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?
       AND r.deleted_at IS NULL
     ORDER BY r.name`,
    [userId]
  );

  const roleCodes = roles.map((role) => role.code);
  const [modulePermissions, fieldPermissions] = await Promise.all([
    getRoleModulePermissions(roleCodes),
    getRoleFieldPermissions(roleCodes)
  ]);

  return {
    roles,
    module_permissions: modulePermissions,
    field_permissions: fieldPermissions
  };
}

module.exports = {
  getRoleFieldPermissions,
  getRoleModulePermissions,
  getUserPermissionSnapshot,
  listActions,
  listModules,
  listRoles
};
