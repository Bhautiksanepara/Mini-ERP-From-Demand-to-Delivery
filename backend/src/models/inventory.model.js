const { pool } = require('../config/database');
const { applyStockMovement } = require('../utils/stock-ledger');

async function listInventorySummary(filters = {}) {
  const where = [];
  const values = [];

  if (filters.search) {
    where.push('(reference LIKE ? OR name LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.low_stock) {
    where.push('free_to_use_qty < 0');
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT
      product_id,
      reference,
      name,
      on_hand_qty,
      reserved_qty,
      free_to_use_qty
     FROM product_inventory_summary
     ${whereSql}
     ORDER BY name
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function listStockLedger(filters = {}) {
  const where = [];
  const values = [];

  if (filters.product_id) {
    where.push('sl.product_id = ?');
    values.push(filters.product_id);
  }

  if (filters.movement_type) {
    where.push('sl.movement_type = ?');
    values.push(filters.movement_type);
  }

  if (filters.reference_type) {
    where.push('sl.reference_type = ?');
    values.push(filters.reference_type);
  }

  if (filters.reference_id) {
    where.push('sl.reference_id = ?');
    values.push(filters.reference_id);
  }

  if (filters.start_date) {
    where.push('sl.created_at >= ?');
    values.push(filters.start_date);
  }

  if (filters.end_date) {
    where.push('sl.created_at <= ?');
    values.push(filters.end_date);
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT
      sl.id,
      sl.product_id,
      p.reference AS product_reference,
      p.name AS product_name,
      sl.movement_type,
      sl.quantity_before,
      sl.quantity_change,
      sl.quantity_after,
      sl.movement_direction,
      sl.reference_type,
      sl.reference_id,
      sl.note,
      sl.created_by,
      u.full_name AS created_by_name,
      sl.created_at
     FROM stock_ledger sl
     INNER JOIN products p ON p.id = sl.product_id
     LEFT JOIN users u ON u.id = sl.created_by
     ${whereSql}
     ORDER BY sl.created_at DESC, sl.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function createManualAdjustment(payload, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const movement = await applyStockMovement({
      connection,
      productId: payload.product_id,
      movementType: 'manual_adjustment',
      quantityChange: payload.quantity_change,
      referenceType: 'Product',
      referenceId: payload.product_id,
      note: payload.note || 'Manual inventory adjustment',
      userId
    });

    await connection.commit();

    return {
      ledger_id: movement.ledger_id,
      product_id: movement.product_id,
      previous_on_hand_qty: movement.quantity_before,
      quantity_change: movement.quantity_change,
      on_hand_qty: movement.quantity_after,
      movement_direction: movement.movement_direction
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createManualAdjustment,
  listInventorySummary,
  listStockLedger
};
