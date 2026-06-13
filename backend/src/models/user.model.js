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

async function list(filters = {}) {
  const where = ['u.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.login_id LIKE ? OR u.position LIKE ?)');
    const searchVal = `%${filters.search}%`;
    values.push(searchVal, searchVal, searchVal, searchVal);
  }

  if (filters.is_active !== undefined) {
    where.push('u.is_active = ?');
    values.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
  }

  let roleJoin = '';
  if (filters.role_code) {
    roleJoin = `
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id AND r.code = ?
    `;
    values.push(filters.role_code);
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);

  const [rows] = await pool.query(
    `SELECT u.id, u.login_id, u.email, u.full_name, u.address, u.mobile_number, u.position, u.profile_photo_mime, u.is_active, u.created_at, u.updated_at,
            (SELECT GROUP_CONCAT(r.code) FROM roles r INNER JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = u.id AND r.deleted_at IS NULL) AS role_codes
     FROM users u
     ${roleJoin}
     WHERE ${where.join(' AND ')}
     ORDER BY u.full_name
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows.map((row) => ({
    ...row,
    roles: row.role_codes ? row.role_codes.split(',') : []
  }));
}

async function update(id, payload, externalConnection = null) {
  const connection = externalConnection || await pool.getConnection();
  const manageTransaction = !externalConnection;

  try {
    if (manageTransaction) {
      await connection.beginTransaction();
    }

    const allowedFields = [
      'full_name',
      'address',
      'mobile_number',
      'position',
      'is_active',
      'profile_photo',
      'profile_photo_mime'
    ];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updates.push(`${field} = ?`);
        values.push(payload[field] ?? null);
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await connection.execute(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE id = ? AND deleted_at IS NULL`,
        values
      );
    }

    if (payload.role_codes) {
      // Delete existing roles
      await connection.execute(
        `DELETE FROM user_roles WHERE user_id = ?`,
        [id]
      );

      if (payload.role_codes.length > 0) {
        const placeholders = payload.role_codes.map(() => '?').join(', ');
        const [roles] = await connection.execute(
          `SELECT id, code, name FROM roles WHERE code IN (${placeholders}) AND deleted_at IS NULL`,
          payload.role_codes
        );

        if (roles.length !== payload.role_codes.length) {
          throw new Error('One or more selected roles do not exist');
        }

        await connection.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ?',
          [roles.map((role) => [id, role.id])]
        );
      }
    }

    if (manageTransaction) {
      await connection.commit();
    }
    return true;
  } catch (error) {
    if (manageTransaction) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (manageTransaction) {
      connection.release();
    }
  }
}

async function softDelete(id) {
  const [result] = await pool.execute(
    `UPDATE users
     SET deleted_at = CURRENT_TIMESTAMP, is_active = FALSE
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  findById,
  findByIdWithRoles,
  findByLoginIdentifier,
  findByLoginIdOrEmail,
  findRolesByUserId,
  list,
  update,
  softDelete
};
