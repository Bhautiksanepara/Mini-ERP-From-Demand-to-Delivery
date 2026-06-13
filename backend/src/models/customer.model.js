const { pool } = require('../config/database');

const columns = `
  id,
  name,
  address,
  email,
  mobile_number,
  created_by,
  created_at,
  updated_at,
  deleted_at,
  deleted_by
`;

async function list(filters = {}) {
  const where = ['deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(name LIKE ? OR email LIKE ? OR mobile_number LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);

  const [rows] = await pool.execute(
    `SELECT ${columns}
     FROM customers
     WHERE ${where.join(' AND ')}
     ORDER BY name
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${columns}
     FROM customers
     WHERE id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function create(payload, userId, connection = pool) {
  const [result] = await connection.execute(
    `INSERT INTO customers (name, address, email, mobile_number, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.address || null,
      payload.email || null,
      payload.mobile_number || null,
      userId
    ]
  );

  return result.insertId;
}

async function update(id, payload, connection = pool) {
  const allowedFields = ['name', 'address', 'email', 'mobile_number'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updates.push(`${field} = ?`);
      values.push(payload[field] || null);
    }
  }

  if (!updates.length) {
    return false;
  }

  values.push(id);

  const [result] = await connection.execute(
    `UPDATE customers
     SET ${updates.join(', ')}
     WHERE id = ?
       AND deleted_at IS NULL`,
    values
  );

  return result.affectedRows > 0;
}

async function softDelete(id, userId, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE customers
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [userId, id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  create,
  findById,
  list,
  softDelete,
  update
};
