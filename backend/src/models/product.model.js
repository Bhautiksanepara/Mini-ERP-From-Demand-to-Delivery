const { pool } = require('../config/database');
const { generateReference } = require('../utils/reference');

const productColumns = `
  p.id,
  p.reference,
  p.name,
  p.sales_price,
  p.cost_price,
  p.on_hand_qty,
  COALESCE(inv.free_to_use_qty, p.on_hand_qty) AS free_to_use_qty,
  p.procure_on_demand,
  p.procurement_method,
  p.vendor_id,
  v.name AS vendor_name,
  p.bom_id,
  b.reference AS bom_reference,
  p.created_by,
  p.created_at,
  p.updated_at,
  p.deleted_at,
  p.deleted_by
`;

async function list(filters = {}) {
  const where = ['p.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(p.reference LIKE ? OR p.name LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);

  const [rows] = await pool.query(
    `SELECT ${productColumns}
     FROM products p
     LEFT JOIN product_inventory_summary inv ON inv.product_id = p.id
     LEFT JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN boms b ON b.id = p.bom_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.name
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function findById(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${productColumns}
     FROM products p
     LEFT JOIN product_inventory_summary inv ON inv.product_id = p.id
     LEFT JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN boms b ON b.id = p.bom_id
     WHERE p.id = ?
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function create(payload, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const reference = await generateReference('product', connection);
    const [result] = await connection.execute(
      `INSERT INTO products (
        reference,
        name,
        sales_price,
        cost_price,
        on_hand_qty,
        procure_on_demand,
        procurement_method,
        vendor_id,
        bom_id,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        payload.name,
        payload.sales_price || 0,
        payload.cost_price || 0,
        payload.on_hand_qty || 0,
        Boolean(payload.procure_on_demand),
        payload.procurement_method || null,
        payload.vendor_id || null,
        payload.bom_id || null,
        userId
      ]
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function update(id, payload, connection = pool) {
  const allowedFields = [
    'name',
    'sales_price',
    'cost_price',
    'on_hand_qty',
    'procure_on_demand',
    'procurement_method',
    'vendor_id',
    'bom_id'
  ];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updates.push(`${field} = ?`);
      values.push(field === 'procure_on_demand' ? Boolean(payload[field]) : payload[field] ?? null);
    }
  }

  if (!updates.length) {
    return false;
  }

  values.push(id);

  const [result] = await connection.execute(
    `UPDATE products
     SET ${updates.join(', ')}
     WHERE id = ?
       AND deleted_at IS NULL`,
    values
  );

  return result.affectedRows > 0;
}

async function softDelete(id, userId, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE products
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
