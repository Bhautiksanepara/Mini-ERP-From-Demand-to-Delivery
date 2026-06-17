const { pool } = require('../config/database');
const { AppError } = require('../utils/app-error');
const { generateReference } = require('../utils/reference');
const { applyStockMovement } = require('../utils/stock-ledger');
const discountRuleModel = require('./discount-rule.model');
const { parsePagination, resolveSort, buildPaginationMeta } = require('../utils/list-query');

const SALES_ORDER_SORT_COLUMNS = {
  reference: 'so.reference',
  order_date: 'so.order_date',
  customer_name: 'c.name',
  sales_person_name: 'u.full_name',
  status: 'so.status',
  total: 'total',
  created_at: 'so.created_at'
};

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
  so.discount_amount,
  so.created_by,
  so.created_at,
  so.updated_at,
  so.deleted_at,
  so.deleted_by,
  COALESCE(SUM(soi.line_total), 0) AS subtotal,
  (COALESCE(SUM(soi.line_total), 0) - so.discount_amount) * 1.18 AS total,
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

async function autoSyncStatuses() {
  await pool.execute(`
    UPDATE sales_orders so
    INNER JOIN (
      SELECT
        sales_order_id,
        COUNT(*) AS total_items,
        SUM(CASE WHEN delivered_qty >= ordered_qty THEN 1 ELSE 0 END) AS fully_done_items,
        SUM(delivered_qty) AS total_delivered
      FROM sales_order_items
      WHERE deleted_at IS NULL
      GROUP BY sales_order_id
    ) t ON t.sales_order_id = so.id
    SET
      so.status = CASE
        WHEN t.total_items > 0 AND t.fully_done_items = t.total_items THEN 'Fully Delivered'
        WHEN t.total_delivered > 0 THEN 'Partially Delivered'
        ELSE 'Confirmed'
      END,
      so.delivered_at = CASE
        WHEN t.total_items > 0 AND t.fully_done_items = t.total_items AND so.delivered_at IS NULL
          THEN CURRENT_TIMESTAMP
        ELSE so.delivered_at
      END
    WHERE so.deleted_at IS NULL
      AND so.status IN ('Confirmed', 'Partially Delivered')
  `);
}

async function list(filters = {}) {
  await autoSyncStatuses();
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

  const { limit, offset, page } = parsePagination(filters);
  const orderBy = resolveSort(filters, SALES_ORDER_SORT_COLUMNS, 'created_at');

  const [rows] = await pool.query(
    `SELECT ${salesOrderColumns}
     FROM sales_orders so
     INNER JOIN customers c ON c.id = so.customer_id
     INNER JOIN users u ON u.id = so.sales_person_id
     LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
       AND soi.deleted_at IS NULL
     WHERE ${where.join(' AND ')}
     GROUP BY so.id
     ORDER BY ${orderBy}, so.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(DISTINCT so.id) AS total
     FROM sales_orders so
     INNER JOIN customers c ON c.id = so.customer_id
     INNER JOIN users u ON u.id = so.sales_person_id
     WHERE ${where.join(' AND ')}`,
    values
  );

  const tabCounts = await getTabCounts(filters);

  return { rows, pagination: buildPaginationMeta(total, page, limit), tab_counts: tabCounts };
}

async function getTabCounts(filters = {}) {
  const where = ['so.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(so.reference LIKE ? OR c.name LIKE ? OR u.full_name LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.mine) {
    where.push('so.sales_person_id = ?');
    values.push(filters.user_id);
  }

  const [[counts]] = await pool.query(
    `SELECT
      COUNT(*) AS \`All\`,
      SUM(so.status = 'Draft') AS \`Draft\`,
      SUM(so.status = 'Confirmed') AS \`Confirmed\`,
      SUM(so.status = 'Partially Delivered') AS \`Partially Delivered\`,
      SUM(so.status = 'Fully Delivered') AS \`Fully Delivered\`,
      SUM(so.status = 'Confirmed' AND so.scheduled_date IS NOT NULL AND so.scheduled_date < CURRENT_TIMESTAMP) AS \`Late\`,
      SUM(so.status = 'Cancelled') AS \`Cancelled\`
     FROM sales_orders so
     INNER JOIN customers c ON c.id = so.customer_id
     INNER JOIN users u ON u.id = so.sales_person_id
     WHERE ${where.join(' AND ')}`,
    values
  );

  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value || 0)]));
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

  await recalculateDiscount(orderId, connection);
}

async function recalculateDiscount(orderId, connection) {
  const [[{ subtotal }]] = await connection.execute(
    `SELECT COALESCE(SUM(line_total), 0) AS subtotal
     FROM sales_order_items
     WHERE sales_order_id = ?
       AND deleted_at IS NULL`,
    [orderId]
  );

  const discount = await discountRuleModel.calculateDiscount('sales_order', subtotal, connection);

  await connection.execute(
    `UPDATE sales_orders SET discount_amount = ? WHERE id = ?`,
    [discount, orderId]
  );
}

async function create(payload, userId, isAdmin = false) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const reference = await generateReference('sales_order', connection);
    const customerAddress = await resolveCustomerAddress(
      payload.customer_id,
      payload.customer_address,
      connection
    );

    const fields = [
      'reference',
      'customer_id',
      'customer_address',
      'sales_person_id',
      'scheduled_date',
      'created_by'
    ];
    const values = [
      reference,
      payload.customer_id,
      customerAddress,
      payload.sales_person_id,
      normalizeDate(payload.scheduled_date),
      userId
    ];

    if (isAdmin && payload.status) {
      fields.push('status');
      values.push(payload.status);

      if (payload.status === 'Confirmed') {
        fields.push('confirmed_at');
        values.push(new Date());
      } else if (['Partially Delivered', 'Fully Delivered'].includes(payload.status)) {
        fields.push('confirmed_at');
        values.push(new Date());
        fields.push('delivered_at');
        values.push(new Date());
      } else if (payload.status === 'Cancelled') {
        fields.push('cancelled_at');
        values.push(new Date());
      }
    }

    const placeholders = fields.map(() => '?').join(', ');
    const [result] = await connection.execute(
      `INSERT INTO sales_orders (${fields.join(', ')}) VALUES (${placeholders})`,
      values
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

async function update(id, payload, isAdmin = false, userId = null) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (!isAdmin && order.status !== 'Draft') {
      throw new AppError('Only Draft Sales Orders can be edited', 409);
    }

    const updates = [];
    const values = [];
    let triggerAutomation = false;

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

    if (isAdmin && Object.prototype.hasOwnProperty.call(payload, 'status')) {
      updates.push('status = ?');
      values.push(payload.status);

      if (payload.status === 'Confirmed' && !order.confirmed_at) {
        updates.push('confirmed_at = CURRENT_TIMESTAMP');
        if (order.status === 'Draft') {
          triggerAutomation = true;
        }
      } else if (['Partially Delivered', 'Fully Delivered'].includes(payload.status)) {
        if (!order.confirmed_at) {
          updates.push('confirmed_at = CURRENT_TIMESTAMP');
        }
        if (!order.delivered_at && payload.status === 'Fully Delivered') {
          updates.push('delivered_at = CURRENT_TIMESTAMP');
        }
      } else if (payload.status === 'Cancelled' && !order.cancelled_at) {
        updates.push('cancelled_at = CURRENT_TIMESTAMP');
      }
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

    if (triggerAutomation) {
      await triggerProcurementAutomation(order, userId, connection);
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

async function triggerProcurementAutomation(order, userId, connection) {
  const items = await findItemsByOrderId(order.id, connection);
  if (items.length === 0) return;

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

async function confirm(id, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (order.status !== 'Draft') {
      throw new AppError('Only Draft Sales Orders can be confirmed', 409);
    }

    await triggerProcurementAutomation(order, userId, connection);

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

async function syncStatus(id) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const order = await assertOrderExists(id, connection);
    const items = await findItemsByOrderId(id, connection);

    if (!items.length) return order.status;

    const allDelivered = items.every(item => Number(item.delivered_qty) >= Number(item.ordered_qty));
    const anyDelivered = items.some(item => Number(item.delivered_qty) > 0);
    const newStatus = allDelivered ? 'Fully Delivered' : anyDelivered ? 'Partially Delivered' : 'Confirmed';

    if (newStatus === order.status) {
      await connection.rollback();
      return newStatus;
    }

    const updates = ['status = ?'];
    const values = [newStatus];
    if (newStatus === 'Fully Delivered' && !order.delivered_at) {
      updates.push('delivered_at = CURRENT_TIMESTAMP');
    }
    if (newStatus !== 'Draft' && !order.confirmed_at) {
      updates.push('confirmed_at = CURRENT_TIMESTAMP');
    }
    values.push(id);
    await connection.execute(
      `UPDATE sales_orders SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values
    );
    await connection.commit();
    return newStatus;
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
  syncStatus,
  update
};
