const { pool } = require('../config/database');
const { AppError } = require('../utils/app-error');
const { generateReference } = require('../utils/reference');
const { applyStockMovement } = require('../utils/stock-ledger');

const manufacturingOrderColumns = `
  mo.id,
  mo.reference,
  mo.schedule_date,
  mo.finished_product_id,
  p.reference AS finished_product_reference,
  p.name AS finished_product_name,
  mo.quantity,
  mo.unit,
  mo.assignee_id,
  u.full_name AS assignee_name,
  mo.bom_id,
  b.reference AS bom_reference,
  mo.status,
  mo.confirmed_at,
  mo.started_at,
  mo.produced_at,
  mo.cancelled_at,
  mo.source_sales_order_id,
  so.reference AS source_sales_order_reference,
  mo.created_by,
  mo.created_at,
  mo.updated_at,
  mo.deleted_at,
  mo.deleted_by,
  COUNT(DISTINCT moc.id) AS component_count,
  COUNT(DISTINCT mow.id) AS work_order_count
`;

const componentColumns = `
  moc.id,
  moc.manufacturing_order_id,
  moc.component_product_id,
  p.reference AS component_product_reference,
  p.name AS component_product_name,
  moc.to_consume_qty,
  moc.consumed_qty,
  moc.unit,
  COALESCE(inv.free_to_use_qty, p.on_hand_qty) AS free_to_use_qty,
  CASE
    WHEN moc.to_consume_qty > COALESCE(inv.free_to_use_qty, p.on_hand_qty) THEN 'Not Available'
    ELSE 'Available'
  END AS availability,
  moc.created_at,
  moc.updated_at
`;

const workOrderColumns = `
  mow.id,
  mow.manufacturing_order_id,
  mow.operation_name,
  mow.work_center_id,
  wc.name AS work_center_name,
  mow.expected_duration_minutes,
  mow.real_duration_minutes,
  mow.sequence_no,
  mow.created_at,
  mow.updated_at
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

async function assertProductsExist(productIds, connection) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean).map((id) => Number(id)))];

  if (!uniqueProductIds.length) {
    return;
  }

  const placeholders = uniqueProductIds.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `SELECT id
     FROM products
     WHERE id IN (${placeholders})
       AND deleted_at IS NULL`,
    uniqueProductIds
  );

  if (rows.length !== uniqueProductIds.length) {
    throw new AppError('One or more selected products do not exist', 400);
  }
}

async function assertWorkCentersExist(workCenterIds, connection) {
  const uniqueWorkCenterIds = [...new Set(workCenterIds.filter(Boolean).map((id) => Number(id)))];

  if (!uniqueWorkCenterIds.length) {
    return;
  }

  const placeholders = uniqueWorkCenterIds.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `SELECT id
     FROM work_centers
     WHERE id IN (${placeholders})
       AND deleted_at IS NULL`,
    uniqueWorkCenterIds
  );

  if (rows.length !== uniqueWorkCenterIds.length) {
    throw new AppError('One or more selected work centers do not exist', 400);
  }
}

async function findBomById(bomId, connection) {
  if (!bomId) {
    return null;
  }

  const [rows] = await connection.execute(
    `SELECT id, finished_product_id, quantity, unit
     FROM boms
     WHERE id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [bomId]
  );

  return rows[0] || null;
}

async function list(filters = {}) {
  const where = ['mo.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(mo.reference LIKE ? OR p.name LIKE ? OR p.reference LIKE ? OR u.full_name LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.status) {
    where.push('mo.status = ?');
    values.push(filters.status);
  }

  if (filters.mine) {
    where.push('mo.assignee_id = ?');
    values.push(filters.user_id);
  }

  if (filters.not_assigned) {
    where.push('mo.assignee_id IS NULL');
  }

  if (filters.late) {
    where.push("mo.status = 'Confirmed'");
    where.push('mo.schedule_date IS NOT NULL');
    where.push('mo.schedule_date < CURRENT_TIMESTAMP');
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);

  const [rows] = await pool.query(
    `SELECT ${manufacturingOrderColumns}
     FROM manufacturing_orders mo
     INNER JOIN products p ON p.id = mo.finished_product_id
     LEFT JOIN users u ON u.id = mo.assignee_id
     LEFT JOIN boms b ON b.id = mo.bom_id
     LEFT JOIN sales_orders so ON so.id = mo.source_sales_order_id
     LEFT JOIN manufacturing_order_components moc ON moc.manufacturing_order_id = mo.id
       AND moc.deleted_at IS NULL
     LEFT JOIN manufacturing_order_work_orders mow ON mow.manufacturing_order_id = mo.id
       AND mow.deleted_at IS NULL
     WHERE ${where.join(' AND ')}
     GROUP BY mo.id
     ORDER BY mo.created_at DESC, mo.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function listDashboardCounts(userId) {
  const [allRows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM manufacturing_orders
     WHERE deleted_at IS NULL
     GROUP BY status`
  );

  const [mineRows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM manufacturing_orders
     WHERE deleted_at IS NULL
       AND assignee_id = ?
     GROUP BY status`,
    [userId]
  );

  const [lateRows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM manufacturing_orders
     WHERE deleted_at IS NULL
       AND status = 'Confirmed'
       AND schedule_date IS NOT NULL
       AND schedule_date < CURRENT_TIMESTAMP`
  );

  const [notAssignedRows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM manufacturing_orders
     WHERE deleted_at IS NULL
       AND assignee_id IS NULL`
  );

  return {
    all: allRows,
    mine: mineRows,
    late: Number(lateRows[0]?.count || 0),
    not_assigned: Number(notAssignedRows[0]?.count || 0)
  };
}

async function findComponentsByOrderId(orderId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${componentColumns}
     FROM manufacturing_order_components moc
     INNER JOIN products p ON p.id = moc.component_product_id
     LEFT JOIN product_inventory_summary inv ON inv.product_id = p.id
     WHERE moc.manufacturing_order_id = ?
       AND moc.deleted_at IS NULL
     ORDER BY moc.id`,
    [orderId]
  );

  return rows;
}

async function findWorkOrdersByOrderId(orderId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${workOrderColumns}
     FROM manufacturing_order_work_orders mow
     INNER JOIN work_centers wc ON wc.id = mow.work_center_id
     WHERE mow.manufacturing_order_id = ?
       AND mow.deleted_at IS NULL
     ORDER BY mow.sequence_no, mow.id`,
    [orderId]
  );

  return rows;
}

async function findById(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${manufacturingOrderColumns}
     FROM manufacturing_orders mo
     INNER JOIN products p ON p.id = mo.finished_product_id
     LEFT JOIN users u ON u.id = mo.assignee_id
     LEFT JOIN boms b ON b.id = mo.bom_id
     LEFT JOIN sales_orders so ON so.id = mo.source_sales_order_id
     LEFT JOIN manufacturing_order_components moc ON moc.manufacturing_order_id = mo.id
       AND moc.deleted_at IS NULL
     LEFT JOIN manufacturing_order_work_orders mow ON mow.manufacturing_order_id = mo.id
       AND mow.deleted_at IS NULL
     WHERE mo.id = ?
       AND mo.deleted_at IS NULL
     GROUP BY mo.id
     LIMIT 1`,
    [id]
  );

  const order = rows[0];

  if (!order) {
    return null;
  }

  const [components, workOrders] = await Promise.all([
    findComponentsByOrderId(id, connection),
    findWorkOrdersByOrderId(id, connection)
  ]);

  return { ...order, components, work_orders: workOrders };
}

async function assertOrderExists(id, connection = pool) {
  const order = await findById(id, connection);

  if (!order) {
    throw new AppError('Manufacturing Order not found', 404);
  }

  return order;
}

async function buildComponentsFromBom(bomId, quantity, connection) {
  if (!bomId) {
    return [];
  }

  const bom = await findBomById(bomId, connection);

  if (!bom) {
    throw new AppError('Bill of Materials not found', 400);
  }

  const multiplier = Number(quantity) / Number(bom.quantity || 1);
  const [rows] = await connection.execute(
    `SELECT component_product_id, to_consume_qty, unit
     FROM bom_components
     WHERE bom_id = ?
       AND deleted_at IS NULL
     ORDER BY id`,
    [bomId]
  );

  return rows.map((component) => ({
    component_product_id: component.component_product_id,
    to_consume_qty: Number(component.to_consume_qty) * multiplier,
    consumed_qty: 0,
    unit: component.unit || 'Units'
  }));
}

async function buildWorkOrdersFromBom(bomId, quantity, connection) {
  if (!bomId) {
    return [];
  }

  const bom = await findBomById(bomId, connection);

  if (!bom) {
    throw new AppError('Bill of Materials not found', 400);
  }

  const multiplier = Number(quantity) / Number(bom.quantity || 1);
  const [rows] = await connection.execute(
    `SELECT operation_name, work_center_id, expected_duration_minutes, sequence_no
     FROM bom_operations
     WHERE bom_id = ?
       AND deleted_at IS NULL
     ORDER BY sequence_no, id`,
    [bomId]
  );

  return rows.map((operation) => ({
    operation_name: operation.operation_name,
    work_center_id: operation.work_center_id,
    expected_duration_minutes: Number(operation.expected_duration_minutes) * multiplier,
    real_duration_minutes: null,
    sequence_no: operation.sequence_no
  }));
}

async function replaceComponents(orderId, components = [], connection) {
  await connection.execute(
    `UPDATE manufacturing_order_components
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE manufacturing_order_id = ?
       AND deleted_at IS NULL`,
    [orderId]
  );

  if (!components.length) {
    return;
  }

  await assertProductsExist(
    components.map((component) => component.component_product_id),
    connection
  );

  for (const component of components) {
    await connection.execute(
      `INSERT INTO manufacturing_order_components (
        manufacturing_order_id,
        component_product_id,
        to_consume_qty,
        consumed_qty,
        unit
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        orderId,
        component.component_product_id,
        component.to_consume_qty,
        component.consumed_qty || 0,
        component.unit || 'Units'
      ]
    );
  }
}

async function replaceWorkOrders(orderId, workOrders = [], connection) {
  await connection.execute(
    `UPDATE manufacturing_order_work_orders
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE manufacturing_order_id = ?
       AND deleted_at IS NULL`,
    [orderId]
  );

  if (!workOrders.length) {
    return;
  }

  await assertWorkCentersExist(
    workOrders.map((workOrder) => workOrder.work_center_id),
    connection
  );

  for (const [index, workOrder] of workOrders.entries()) {
    await connection.execute(
      `INSERT INTO manufacturing_order_work_orders (
        manufacturing_order_id,
        operation_name,
        work_center_id,
        expected_duration_minutes,
        real_duration_minutes,
        sequence_no
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        workOrder.operation_name,
        workOrder.work_center_id,
        workOrder.expected_duration_minutes || 0,
        workOrder.real_duration_minutes ?? null,
        workOrder.sequence_no || index + 1
      ]
    );
  }
}

async function create(payload, userId, externalConnection = null) {
  const connection = externalConnection || await pool.getConnection();
  const manageTransaction = !externalConnection;

  try {
    if (manageTransaction) {
      await connection.beginTransaction();
    }

    await assertProductsExist([payload.finished_product_id], connection);

    const bom = await findBomById(payload.bom_id, connection);

    if (payload.bom_id && !bom) {
      throw new AppError('Bill of Materials not found', 400);
    }

    if (bom && Number(bom.finished_product_id) !== Number(payload.finished_product_id)) {
      throw new AppError('Selected BoM does not match the finished product', 400);
    }

    const reference = await generateReference('manufacturing_order', connection);
    const [result] = await connection.execute(
      `INSERT INTO manufacturing_orders (
        reference,
        schedule_date,
        finished_product_id,
        quantity,
        unit,
        assignee_id,
        bom_id,
        source_sales_order_id,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        normalizeDate(payload.schedule_date),
        payload.finished_product_id,
        payload.quantity,
        payload.unit || 'Units',
        payload.assignee_id || null,
        payload.bom_id || null,
        payload.source_sales_order_id || null,
        userId
      ]
    );

    const components = payload.components || await buildComponentsFromBom(
      payload.bom_id,
      payload.quantity,
      connection
    );
    const workOrders = payload.work_orders || await buildWorkOrdersFromBom(
      payload.bom_id,
      payload.quantity,
      connection
    );

    await replaceComponents(result.insertId, components, connection);
    await replaceWorkOrders(result.insertId, workOrders, connection);

    if (manageTransaction) {
      await connection.commit();
    }

    return result.insertId;
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

async function update(id, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (!['Draft', 'Confirmed', 'In Progress'].includes(order.status)) {
      throw new AppError('This Manufacturing Order cannot be edited', 409);
    }

    if (payload.finished_product_id) {
      await assertProductsExist([payload.finished_product_id], connection);
    }

    const nextFinishedProductId = payload.finished_product_id || order.finished_product_id;
    const nextQuantity = payload.quantity || order.quantity;
    const nextBomId = Object.prototype.hasOwnProperty.call(payload, 'bom_id')
      ? payload.bom_id
      : order.bom_id;
    const bom = await findBomById(nextBomId, connection);

    if (nextBomId && !bom) {
      throw new AppError('Bill of Materials not found', 400);
    }

    if (bom && Number(bom.finished_product_id) !== Number(nextFinishedProductId)) {
      throw new AppError('Selected BoM does not match the finished product', 400);
    }

    const updates = [];
    const values = [];

    for (const field of [
      'schedule_date',
      'finished_product_id',
      'quantity',
      'unit',
      'assignee_id',
      'bom_id',
      'source_sales_order_id'
    ]) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updates.push(`${field} = ?`);
        values.push(field === 'schedule_date' ? normalizeDate(payload[field]) : payload[field] ?? null);
      }
    }

    if (updates.length) {
      values.push(id);
      await connection.execute(
        `UPDATE manufacturing_orders
         SET ${updates.join(', ')}
         WHERE id = ?
           AND deleted_at IS NULL`,
        values
      );
    }

    if (payload.components) {
      await replaceComponents(id, payload.components, connection);
    } else if (payload.bom_id || payload.quantity) {
      await replaceComponents(
        id,
        await buildComponentsFromBom(nextBomId, nextQuantity, connection),
        connection
      );
    }

    if (payload.work_orders) {
      await replaceWorkOrders(id, payload.work_orders, connection);
    } else if (payload.bom_id || payload.quantity) {
      await replaceWorkOrders(
        id,
        await buildWorkOrdersFromBom(nextBomId, nextQuantity, connection),
        connection
      );
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
      throw new AppError('Only Draft Manufacturing Orders can be confirmed', 409);
    }

    await connection.execute(
      `UPDATE manufacturing_orders
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

async function start(id) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (order.status !== 'Confirmed') {
      throw new AppError('Only Confirmed Manufacturing Orders can be started', 409);
    }

    await connection.execute(
      `UPDATE manufacturing_orders
       SET status = 'In Progress',
           started_at = CURRENT_TIMESTAMP
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

async function produce(id, payload = {}, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (!['Confirmed', 'In Progress'].includes(order.status)) {
      throw new AppError('Only Confirmed or In Progress Manufacturing Orders can be produced', 409);
    }

    const currentComponents = await findComponentsByOrderId(id, connection);
    const componentById = new Map(currentComponents.map((component) => [Number(component.id), component]));
    const submittedComponents = payload.components || currentComponents.map((component) => ({
      component_id: component.id,
      consumed_qty: component.to_consume_qty
    }));

    for (const component of submittedComponents) {
      const componentId = Number(component.component_id);

      if (!componentById.has(componentId)) {
        throw new AppError('One or more consumed components do not belong to this Manufacturing Order', 400);
      }

      const currentComponent = componentById.get(componentId);
      const previousQty = Number(currentComponent.consumed_qty);
      const consumedQty = Number(component.consumed_qty);

      if (consumedQty < previousQty) {
        throw new AppError('Consumed quantity cannot be reduced', 400);
      }

      if (consumedQty > Number(currentComponent.to_consume_qty)) {
        throw new AppError('Consumed quantity cannot be greater than to consume quantity', 400);
      }

      const delta = consumedQty - previousQty;

      if (delta <= 0) {
        continue;
      }

      await connection.execute(
        `UPDATE manufacturing_order_components
         SET consumed_qty = ?
         WHERE id = ?
           AND manufacturing_order_id = ?
           AND deleted_at IS NULL`,
        [consumedQty, componentId, id]
      );

      await applyStockMovement({
        connection,
        productId: currentComponent.component_product_id,
        movementType: 'manufacturing_consumption',
        quantityChange: -delta,
        referenceType: 'Manufacturing Order',
        referenceId: id,
        note: `Consumed for ${order.reference}`,
        userId
      });
    }

    for (const workOrder of payload.work_orders || []) {
      await connection.execute(
        `UPDATE manufacturing_order_work_orders
         SET real_duration_minutes = ?
         WHERE id = ?
           AND manufacturing_order_id = ?
           AND deleted_at IS NULL`,
        [workOrder.real_duration_minutes, workOrder.work_order_id, id]
      );
    }

    await applyStockMovement({
      connection,
      productId: order.finished_product_id,
      movementType: 'manufacturing_production',
      quantityChange: order.quantity,
      referenceType: 'Manufacturing Order',
      referenceId: id,
      note: `Produced from ${order.reference}`,
      userId
    });

    await connection.execute(
      `UPDATE manufacturing_orders
       SET status = 'Done',
           produced_at = CURRENT_TIMESTAMP
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

async function cancel(id) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await assertOrderExists(id, connection);

    if (['Done', 'Cancelled'].includes(order.status)) {
      throw new AppError('This Manufacturing Order cannot be cancelled', 409);
    }

    await connection.execute(
      `UPDATE manufacturing_orders
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
  produce,
  start,
  update
};
