const { pool } = require('../config/database');
const { AppError } = require('../utils/app-error');
const { generateReference } = require('../utils/reference');
const { applyStockMovement } = require('../utils/stock-ledger');

const salesOrderColumns = `
  so.id,
  so.reference,
  so.customer_id,
  c.name AS customer_name,
  so.customer_address,
  so.sales_person_id,
  u.full_name AS sales_person_name,
  so.status,
  so.order_date,
  so.scheduled_date,
  so.confirmed_at,
  so.delivered_at,
  so.cancelled_at,
  so.created_by,
  so.created_at,
  so.updated_at,
  so.deleted_at,
  so.deleted_by,
  COALESCE(SUM(soi.line_total), 0) AS total,
  COUNT(soi.id) AS item_count
`;

const salesOrderItemColumns = `
  soi.id,
  soi.sales_order_id,
  soi.product_id,
  p.reference AS product_reference,
  p.name AS product_name,
  soi.ordered_qty,
  soi.delivered_qty,
  soi.sales_unit_price,
  soi.line_total,
  COALESCE(inv.free_to_use_qty, p.on_hand_qty) AS free_to_use_qty,
  CASE
    WHEN soi.ordered_qty > COALESCE(inv.free_to_use_qty, p.on_hand_qty) THEN 'Not Available'
    ELSE 'Available'
  END AS availability
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
    throw new AppError('Sales Order not found', 404);
  }

  return order;
}

async function list(filters = {}) {
  const where = ['so.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(so.reference LIKE ? OR c.name LIKE ? OR u.full_name LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.status) {
    where.push('so.status = ?');
    values.push(filters.status);
  }

  if (filters.mine) {
    where.push('so.sales_person_id = ?');
    values.push(filters.user_id);
  }

  if (filters.late) {
    where.push("so.status = 'Confirmed'");
    where.push('so.scheduled_date IS NOT NULL');
    where.push('so.scheduled_date < CURRENT_TIMESTAMP');
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);

  const [rows] = await pool.query(
    `SELECT ${salesOrderColumns}
     FROM sales_orders so
     INNER JOIN customers c ON c.id = so.customer_id
     INNER JOIN users u ON u.id = so.sales_person_id
     LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
       AND soi.deleted_at IS NULL
     WHERE ${where.join(' AND ')}
     GROUP BY so.id
     ORDER BY so.created_at DESC, so.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function listDashboardCounts(userId) {
  const [allRows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM sales_orders
     WHERE deleted_at IS NULL
     GROUP BY status`
  );

  const [mineRows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM sales_orders
     WHERE deleted_at IS NULL
       AND sales_person_id = ?
     GROUP BY status`,
    [userId]
  );

  const [lateRows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM sales_orders
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
    `SELECT ${salesOrderItemColumns}
     FROM sales_order_items soi
     INNER JOIN products p ON p.id = soi.product_id
     LEFT JOIN product_inventory_summary inv ON inv.product_id = p.id
     WHERE soi.sales_order_id = ?
       AND soi.deleted_at IS NULL
     ORDER BY soi.id`,
    [orderId]
  );

  return items;
}

async function findById(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${salesOrderColumns}
     FROM sales_orders so
     INNER JOIN customers c ON c.id = so.customer_id
     INNER JOIN users u ON u.id = so.sales_person_id
     LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
       AND soi.deleted_at IS NULL
     WHERE so.id = ?
       AND so.deleted_at IS NULL
     GROUP BY so.id
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

async function resolveCustomerAddress(customerId, fallbackAddress, connection) {
  if (fallbackAddress) {
    return fallbackAddress;
  }

  const [rows] = await connection.execute(
    `SELECT address
     FROM customers
     WHERE id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [customerId]
  );

  return rows[0]?.address || null;
}

async function getProductPrices(productIds, connection) {
  const uniqueProductIds = [...new Set(productIds)];
  const placeholders = uniqueProductIds.map(() => '?').join(', ');
  const [products] = await connection.execute(
    `SELECT id, sales_price
     FROM products
     WHERE id IN (${placeholders})
       AND deleted_at IS NULL`,
    uniqueProductIds
  );

  if (products.length !== uniqueProductIds.length) {
    throw new AppError('One or more selected products do not exist', 400);
  }

  return new Map(products.map((product) => [Number(product.id), product.sales_price]));
}

async function replaceItems(orderId, items, connection) {
  await connection.execute(
    `UPDATE sales_order_items
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE sales_order_id = ?
       AND deleted_at IS NULL`,
    [orderId]
  );

  const priceByProductId = await getProductPrices(
    items.map((item) => Number(item.product_id)),
    connection
  );

  for (const item of items) {
    await connection.execute(
      `INSERT INTO sales_order_items (
        sales_order_id,
        product_id,
        ordered_qty,
        delivered_qty,
        sales_unit_price
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        orderId,
        item.product_id,
        item.ordered_qty,
        item.delivered_qty || 0,
        item.sales_unit_price ?? priceByProductId.get(Number(item.product_id))
      ]
    );
  }
}

async function create(payload, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const reference = await generateReference('sales_order', connection);
    const customerAddress = await resolveCustomerAddress(
      payload.customer_id,
      payload.customer_address,
      connection
    );
    const [result] = await connection.execute(
      `INSERT INTO sales_orders (
        reference,
        customer_id,
        customer_address,
        sales_person_id,
        scheduled_date,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        reference,
        payload.customer_id,
        customerAddress,
        payload.sales_person_id,
        normalizeDate(payload.scheduled_date),
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
      throw new AppError('Only Draft Sales Orders can be edited', 409);
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(payload, 'customer_id')) {
      updates.push('customer_id = ?');
      values.push(payload.customer_id);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'customer_address')) {
      updates.push('customer_address = ?');
      values.push(payload.customer_address || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'sales_person_id')) {
      updates.push('sales_person_id = ?');
      values.push(payload.sales_person_id);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'scheduled_date')) {
      updates.push('scheduled_date = ?');
      values.push(normalizeDate(payload.scheduled_date));
    }

    if (updates.length) {
      values.push(id);
      await connection.execute(
        `UPDATE sales_orders
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

async function confirm(id, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (order.status !== 'Draft') {
      throw new AppError('Only Draft Sales Orders can be confirmed', 409);
    }

    const items = await findItemsByOrderId(id, connection);
    if (items.length > 0) {
      const productIds = items.map((item) => Number(item.product_id));
      const placeholders = productIds.map(() => '?').join(', ');
      
      const [productRows] = await connection.execute(
        `SELECT p.id, p.name, p.procure_on_demand, p.procurement_method, p.vendor_id, p.bom_id, p.cost_price,
                COALESCE(inv.free_to_use_qty, p.on_hand_qty) AS free_to_use_qty
         FROM products p
         LEFT JOIN product_inventory_summary inv ON inv.product_id = p.id
         WHERE p.id IN (${placeholders})
           AND p.deleted_at IS NULL`,
        productIds
      );
      
      const productMap = new Map(productRows.map((p) => [Number(p.id), p]));
      const purchaseShortagesByVendor = new Map();
      const manufacturingShortages = [];

      for (const item of items) {
        const product = productMap.get(Number(item.product_id));
        if (!product) continue;

        const freeToUse = Number(product.free_to_use_qty);
        const ordered = Number(item.ordered_qty);
        const available = Math.max(0, freeToUse);
        const shortage = ordered - available;

        if (shortage > 0 && product.procure_on_demand) {
          if (product.procurement_method === 'purchase') {
            if (!product.vendor_id) {
              throw new AppError(`Vendor is not configured for procure-on-demand product "${product.name || item.product_name}"`, 400);
            }
            const vendorId = Number(product.vendor_id);
            if (!purchaseShortagesByVendor.has(vendorId)) {
              purchaseShortagesByVendor.set(vendorId, []);
            }
            purchaseShortagesByVendor.get(vendorId).push({
              product_id: product.id,
              ordered_qty: shortage,
              cost_price: product.cost_price
            });
          } else if (product.procurement_method === 'manufacturing') {
            if (!product.bom_id) {
              throw new AppError(`BoM is not configured for procure-on-demand product "${product.name || item.product_name}"`, 400);
            }
            manufacturingShortages.push({
              finished_product_id: product.id,
              quantity: shortage,
              bom_id: product.bom_id
            });
          }
        }
      }

      // Trigger automatic Purchase Orders
      if (purchaseShortagesByVendor.size > 0) {
        const purchaseOrderModel = require('./purchase-order.model');
        for (const [vendorId, poItems] of purchaseShortagesByVendor.entries()) {
          const poPayload = {
            vendor_id: vendorId,
            responsible_user_id: order.sales_person_id,
            source_sales_order_id: order.id,
            items: poItems
          };
          await purchaseOrderModel.create(poPayload, userId, connection);
        }
      }

      // Trigger automatic Manufacturing Orders
      if (manufacturingShortages.length > 0) {
        const manufacturingOrderModel = require('./manufacturing-order.model');
        for (const moShortage of manufacturingShortages) {
          const moPayload = {
            finished_product_id: moShortage.finished_product_id,
            quantity: moShortage.quantity,
            bom_id: moShortage.bom_id,
            source_sales_order_id: order.id
          };
          await manufacturingOrderModel.create(moPayload, userId, connection);
        }
      }
    }

    await connection.execute(
      `UPDATE sales_orders
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

async function deliver(id, payload, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (!['Confirmed', 'Partially Delivered'].includes(order.status)) {
      throw new AppError('Only Confirmed or Partially Delivered Sales Orders can be delivered', 409);
    }

    const currentItems = await findItemsByOrderId(id, connection);
    const currentById = new Map(currentItems.map((item) => [Number(item.id), item]));
    const deliveryByItemId = new Map();

    for (const item of payload.items) {
      const itemId = Number(item.item_id);

      if (!currentById.has(itemId)) {
        throw new AppError('One or more delivered items do not belong to this Sales Order', 400);
      }

      if (deliveryByItemId.has(itemId)) {
        throw new AppError('Duplicate delivered item submitted', 400);
      }

      deliveryByItemId.set(itemId, Number(item.delivered_qty));
    }

    let hasIncrease = false;

    for (const [itemId, deliveredQty] of deliveryByItemId.entries()) {
      const currentItem = currentById.get(itemId);
      const previousQty = Number(currentItem.delivered_qty);
      const orderedQty = Number(currentItem.ordered_qty);

      if (deliveredQty < previousQty) {
        throw new AppError('Delivered quantity cannot be reduced', 400);
      }

      if (deliveredQty > orderedQty) {
        throw new AppError('Delivered quantity cannot be greater than ordered quantity', 400);
      }

      const delta = deliveredQty - previousQty;

      if (delta <= 0) {
        continue;
      }

      hasIncrease = true;

      await connection.execute(
        `UPDATE sales_order_items
         SET delivered_qty = ?
         WHERE id = ?
           AND sales_order_id = ?
           AND deleted_at IS NULL`,
        [deliveredQty, itemId, id]
      );

      await applyStockMovement({
        connection,
        productId: currentItem.product_id,
        movementType: 'sales_delivery',
        quantityChange: -delta,
        referenceType: 'Sales Order',
        referenceId: id,
        note: `Delivered from ${order.reference}`,
        userId
      });
    }

    if (!hasIncrease) {
      throw new AppError('At least one delivered quantity must be increased', 400);
    }

    const refreshedItems = await findItemsByOrderId(id, connection);
    const allDelivered = refreshedItems.every(
      (item) => Number(item.delivered_qty) === Number(item.ordered_qty)
    );
    const anyDelivered = refreshedItems.some((item) => Number(item.delivered_qty) > 0);
    const nextStatus = allDelivered ? 'Fully Delivered' : anyDelivered ? 'Partially Delivered' : 'Confirmed';

    await connection.execute(
      `UPDATE sales_orders
       SET status = ?,
           delivered_at = CASE WHEN ? = 'Fully Delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
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

    if (['Fully Delivered', 'Cancelled'].includes(order.status)) {
      throw new AppError('This Sales Order cannot be cancelled', 409);
    }

    await connection.execute(
      `UPDATE sales_orders
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
  deliver,
  findById,
  list,
  listDashboardCounts,
  update
};
