const { pool } = require('../config/database');
const { AppError } = require('../utils/app-error');
const { generateReference } = require('../utils/reference');

const purchaseOrderColumns = `
  po.id,
  po.reference,
  po.vendor_id,
  v.name AS vendor_name,
  po.vendor_address,
  po.responsible_user_id,
  u.full_name AS responsible_user_name,
  po.status,
  po.order_date,
  po.scheduled_date,
  po.confirmed_at,
  po.received_at,
  po.cancelled_at,
  po.source_sales_order_id,
  so.reference AS source_sales_order_reference,
  po.created_by,
  po.created_at,
  po.updated_at,
  po.deleted_at,
  po.deleted_by,
  COALESCE(SUM(poi.line_total), 0) AS total,
  COUNT(poi.id) AS item_count
`;

const purchaseOrderItemColumns = `
  poi.id,
  poi.purchase_order_id,
  poi.product_id,
  p.reference AS product_reference,
  p.name AS product_name,
  poi.ordered_qty,
  poi.received_qty,
  poi.cost_price,
  poi.line_total,
  p.on_hand_qty
`;

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

async function assertOrderExists(id, connection = pool) {
  const order = await findById(id, connection);

  if (!order) {
    throw new AppError('Purchase Order not found', 404);
  }

  return order;
}

async function list(filters = {}) {
  const where = ['po.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(po.reference LIKE ? OR v.name LIKE ? OR u.full_name LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.status) {
    where.push('po.status = ?');
    values.push(filters.status);
  }

  if (filters.mine) {
    where.push('po.responsible_user_id = ?');
    values.push(filters.user_id);
  }

  if (filters.late) {
    where.push("po.status = 'Confirmed'");
    where.push('po.scheduled_date IS NOT NULL');
    where.push('po.scheduled_date < CURRENT_TIMESTAMP');
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);

  const [rows] = await pool.execute(
    `SELECT ${purchaseOrderColumns}
     FROM purchase_orders po
     INNER JOIN vendors v ON v.id = po.vendor_id
     INNER JOIN users u ON u.id = po.responsible_user_id
     LEFT JOIN sales_orders so ON so.id = po.source_sales_order_id
     LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
       AND poi.deleted_at IS NULL
     WHERE ${where.join(' AND ')}
     GROUP BY po.id
     ORDER BY po.created_at DESC, po.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function listDashboardCounts(userId) {
  const [allRows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM purchase_orders
     WHERE deleted_at IS NULL
     GROUP BY status`
  );

  const [mineRows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM purchase_orders
     WHERE deleted_at IS NULL
       AND responsible_user_id = ?
     GROUP BY status`,
    [userId]
  );

  const [lateRows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM purchase_orders
     WHERE deleted_at IS NULL
       AND status = 'Confirmed'
       AND scheduled_date IS NOT NULL
       AND scheduled_date < CURRENT_TIMESTAMP`
  );

  return {
    all: allRows,
    mine: mineRows,
    late: Number(lateRows[0]?.count || 0)
  };
}

async function findItemsByOrderId(orderId, connection = pool) {
  const [items] = await connection.execute(
    `SELECT ${purchaseOrderItemColumns}
     FROM purchase_order_items poi
     INNER JOIN products p ON p.id = poi.product_id
     WHERE poi.purchase_order_id = ?
       AND poi.deleted_at IS NULL
     ORDER BY poi.id`,
    [orderId]
  );

  return items;
}

async function findById(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${purchaseOrderColumns}
     FROM purchase_orders po
     INNER JOIN vendors v ON v.id = po.vendor_id
     INNER JOIN users u ON u.id = po.responsible_user_id
     LEFT JOIN sales_orders so ON so.id = po.source_sales_order_id
     LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
       AND poi.deleted_at IS NULL
     WHERE po.id = ?
       AND po.deleted_at IS NULL
     GROUP BY po.id
     LIMIT 1`,
    [id]
  );

  const order = rows[0];

  if (!order) {
    return null;
  }

  const items = await findItemsByOrderId(id, connection);
  return { ...order, items };
}

async function resolveVendorAddress(vendorId, fallbackAddress, connection) {
  if (fallbackAddress) {
    return fallbackAddress;
  }

  const [rows] = await connection.execute(
    `SELECT address
     FROM vendors
     WHERE id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [vendorId]
  );

  return rows[0]?.address || null;
}

async function getProductCosts(productIds, connection) {
  const uniqueProductIds = [...new Set(productIds)];
  const placeholders = uniqueProductIds.map(() => '?').join(', ');
  const [products] = await connection.execute(
    `SELECT id, cost_price
     FROM products
     WHERE id IN (${placeholders})
       AND deleted_at IS NULL`,
    uniqueProductIds
  );

  if (products.length !== uniqueProductIds.length) {
    throw new AppError('One or more selected products do not exist', 400);
  }

  return new Map(products.map((product) => [Number(product.id), product.cost_price]));
}

async function replaceItems(orderId, items, connection) {
  await connection.execute(
    `UPDATE purchase_order_items
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE purchase_order_id = ?
       AND deleted_at IS NULL`,
    [orderId]
  );

  const costByProductId = await getProductCosts(
    items.map((item) => Number(item.product_id)),
    connection
  );

  for (const item of items) {
    await connection.execute(
      `INSERT INTO purchase_order_items (
        purchase_order_id,
        product_id,
        ordered_qty,
        received_qty,
        cost_price
      ) VALUES (?, ?, ?, 0, ?)`,
      [
        orderId,
        item.product_id,
        item.ordered_qty,
        item.cost_price ?? costByProductId.get(Number(item.product_id))
      ]
    );
  }
}

async function create(payload, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const reference = await generateReference('purchase_order', connection);
    const vendorAddress = await resolveVendorAddress(
      payload.vendor_id,
      payload.vendor_address,
      connection
    );
    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (
        reference,
        vendor_id,
        vendor_address,
        responsible_user_id,
        scheduled_date,
        source_sales_order_id,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        payload.vendor_id,
        vendorAddress,
        payload.responsible_user_id,
        normalizeDate(payload.scheduled_date),
        payload.source_sales_order_id || null,
        userId
      ]
    );

    await replaceItems(result.insertId, payload.items, connection);
    await connection.commit();

    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function update(id, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (order.status !== 'Draft') {
      throw new AppError('Only Draft Purchase Orders can be edited', 409);
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(payload, 'vendor_id')) {
      updates.push('vendor_id = ?');
      values.push(payload.vendor_id);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'vendor_address')) {
      updates.push('vendor_address = ?');
      values.push(payload.vendor_address || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'responsible_user_id')) {
      updates.push('responsible_user_id = ?');
      values.push(payload.responsible_user_id);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'scheduled_date')) {
      updates.push('scheduled_date = ?');
      values.push(normalizeDate(payload.scheduled_date));
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'source_sales_order_id')) {
      updates.push('source_sales_order_id = ?');
      values.push(payload.source_sales_order_id || null);
    }

    if (updates.length) {
      values.push(id);
      await connection.execute(
        `UPDATE purchase_orders
         SET ${updates.join(', ')}
         WHERE id = ?
           AND deleted_at IS NULL`,
        values
      );
    }

    if (payload.items) {
      await replaceItems(id, payload.items, connection);
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function confirm(id) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (order.status !== 'Draft') {
      throw new AppError('Only Draft Purchase Orders can be confirmed', 409);
    }

    await connection.execute(
      `UPDATE purchase_orders
       SET status = 'Confirmed',
           confirmed_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND deleted_at IS NULL`,
      [id]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function receive(id, payload, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (!['Confirmed', 'Partially Received'].includes(order.status)) {
      throw new AppError('Only Confirmed or Partially Received Purchase Orders can be received', 409);
    }

    const currentItems = await findItemsByOrderId(id, connection);
    const currentById = new Map(currentItems.map((item) => [Number(item.id), item]));
    const receiveByItemId = new Map();

    for (const item of payload.items) {
      const itemId = Number(item.item_id);

      if (!currentById.has(itemId)) {
        throw new AppError('One or more received items do not belong to this Purchase Order', 400);
      }

      if (receiveByItemId.has(itemId)) {
        throw new AppError('Duplicate received item submitted', 400);
      }

      receiveByItemId.set(itemId, Number(item.received_qty));
    }

    let hasIncrease = false;

    for (const [itemId, receivedQty] of receiveByItemId.entries()) {
      const currentItem = currentById.get(itemId);
      const previousQty = Number(currentItem.received_qty);
      const orderedQty = Number(currentItem.ordered_qty);

      if (receivedQty < previousQty) {
        throw new AppError('Received quantity cannot be reduced', 400);
      }

      if (receivedQty > orderedQty) {
        throw new AppError('Received quantity cannot be greater than ordered quantity', 400);
      }

      const delta = receivedQty - previousQty;

      if (delta <= 0) {
        continue;
      }

      hasIncrease = true;

      await connection.execute(
        `UPDATE purchase_order_items
         SET received_qty = ?
         WHERE id = ?
           AND purchase_order_id = ?
           AND deleted_at IS NULL`,
        [receivedQty, itemId, id]
      );

      await connection.execute(
        `UPDATE products
         SET on_hand_qty = on_hand_qty + ?
         WHERE id = ?
           AND deleted_at IS NULL`,
        [delta, currentItem.product_id]
      );

      await connection.execute(
        `INSERT INTO stock_ledger (
          product_id,
          movement_type,
          quantity_change,
          reference_type,
          reference_id,
          note,
          created_by
        ) VALUES (?, 'purchase_receipt', ?, 'Purchase Order', ?, ?, ?)`,
        [
          currentItem.product_id,
          delta,
          id,
          `Received from ${order.reference}`,
          userId
        ]
      );
    }

    if (!hasIncrease) {
      throw new AppError('At least one received quantity must be increased', 400);
    }

    const refreshedItems = await findItemsByOrderId(id, connection);
    const allReceived = refreshedItems.every(
      (item) => Number(item.received_qty) === Number(item.ordered_qty)
    );
    const anyReceived = refreshedItems.some((item) => Number(item.received_qty) > 0);
    const nextStatus = allReceived ? 'Fully Received' : anyReceived ? 'Partially Received' : 'Confirmed';

    await connection.execute(
      `UPDATE purchase_orders
       SET status = ?,
           received_at = CASE WHEN ? = 'Fully Received' THEN CURRENT_TIMESTAMP ELSE received_at END
       WHERE id = ?
         AND deleted_at IS NULL`,
      [nextStatus, nextStatus, id]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancel(id) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (['Fully Received', 'Cancelled'].includes(order.status)) {
      throw new AppError('This Purchase Order cannot be cancelled', 409);
    }

    await connection.execute(
      `UPDATE purchase_orders
       SET status = 'Cancelled',
           cancelled_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND deleted_at IS NULL`,
      [id]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  cancel,
  confirm,
  create,
  findById,
  list,
  listDashboardCounts,
  receive,
  update
};
