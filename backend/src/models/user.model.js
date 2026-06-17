const { pool } = require('../config/database');
const { parsePagination, resolveSort, buildPaginationMeta } = require('../utils/list-query');

const USER_SORT_COLUMNS = {
  login_id: 'u.login_id',
  full_name: 'u.full_name',
  email: 'u.email',
  mobile_number: 'u.mobile_number',
  position: 'u.position',
  is_active: 'u.is_active',
  created_at: 'u.created_at'
};

const userColumns = `
  id,
  login_id,
  email,
  password_hash,
  full_name,
  address,
  mobile_number,
  position,
  profile_photo,
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
  const [userRows] = await pool.execute(
    `SELECT roles FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  const userRolesStr = userRows[0]?.roles || '';
  if (!userRolesStr) {
    return [];
  }
  const roleCodes = userRolesStr.split(',');
  const placeholders = roleCodes.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT id, name, code
     FROM roles
     WHERE code IN (${placeholders})
       AND deleted_at IS NULL
     ORDER BY name`,
    roleCodes
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

  if (filters.role_code) {
    where.push('FIND_IN_SET(?, u.roles) > 0');
    values.push(filters.role_code);
  }

  if (filters.role_filter === 'admin') {
    where.push("FIND_IN_SET('admin', u.roles) > 0");
  } else if (filters.role_filter === 'non_admin') {
    where.push("(FIND_IN_SET('admin', u.roles) = 0 OR u.roles IS NULL OR u.roles = '')");
  }

  const { limit, offset, page } = parsePagination(filters);
  const orderBy = resolveSort(filters, USER_SORT_COLUMNS, 'full_name', 'asc');

  const [rows] = await pool.query(
    `SELECT u.id, u.login_id, u.email, u.full_name, u.address, u.mobile_number, u.position, u.profile_photo_mime, u.is_active, u.created_at, u.updated_at,
            u.roles AS role_codes
     FROM users u
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy}, u.id ASC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users u
     WHERE ${where.join(' AND ')}`,
    values
  );

  const tabCounts = await getTabCounts(filters);

  return {
    rows: rows.map((row) => ({
      ...row,
      roles: row.role_codes ? row.role_codes.split(',') : []
    })),
    pagination: buildPaginationMeta(total, page, limit),
    tab_counts: tabCounts
  };
}

async function getTabCounts(filters = {}) {
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

  const [[counts]] = await pool.query(
    `SELECT
      COUNT(*) AS \`All Users\`,
      SUM(FIND_IN_SET('admin', u.roles) = 0 OR u.roles IS NULL OR u.roles = '') AS \`System Users\`,
      SUM(FIND_IN_SET('admin', u.roles) > 0) AS \`Administrators\`
     FROM users u
     WHERE ${where.join(' AND ')}`,
    values
  );

  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value || 0)]));
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

    if (payload.role_codes) {
      updates.push('roles = ?');
      values.push(payload.role_codes.join(','));
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
