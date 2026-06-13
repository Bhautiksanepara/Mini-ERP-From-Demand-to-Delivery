const { pool } = require('../config/database');

const userColumns = `
  id,
  login_id,
  email,
  password_hash,
  full_name,
  address,
  mobile_number,
  position,
  profile_photo_mime,
  is_active,
  created_at,
  updated_at,
  deleted_at
`;

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${userColumns} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function findByLoginIdentifier(identifier) {
  const [rows] = await pool.execute(
    `SELECT ${userColumns}
     FROM users
     WHERE login_id = ? OR email = ?
     LIMIT 1`,
    [identifier, identifier]
  );

  return rows[0] || null;
}

async function findByLoginIdOrEmail(loginId, email) {
  const [rows] = await pool.execute(
    `SELECT id FROM users WHERE login_id = ? OR email = ? LIMIT 1`,
    [loginId, email]
  );

  return rows[0] || null;
}

async function findRolesByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT r.id, r.name, r.code
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?
       AND r.deleted_at IS NULL
     ORDER BY r.name`,
    [userId]
  );

  return rows;
}

async function findByIdWithRoles(id) {
  const user = await findById(id);

  if (!user) {
    return null;
  }

  const roles = await findRolesByUserId(id);
  return { ...user, roles };
}

module.exports = {
  findById,
  findByIdWithRoles,
  findByLoginIdentifier,
  findByLoginIdOrEmail,
  findRolesByUserId
};
