const { pool } = require('../config/database');
const { AppError } = require('../utils/app-error');
const { generateReference } = require('../utils/reference');
const { parsePagination, resolveSort, buildPaginationMeta } = require('../utils/list-query');

const BOM_SORT_COLUMNS = {
  reference: 'b.reference',
  finished_product_name: 'p.name',
  quantity: 'b.quantity',
  component_count: 'component_count',
  operation_count: 'operation_count',
  created_at: 'b.created_at'
};

const bomColumns = `
  b.id,
  b.reference,
  b.finished_product_id,
  p.reference AS finished_product_reference,
  p.name AS finished_product_name,
  b.quantity,
  b.unit,
  b.created_by,
  b.created_at,
  b.updated_at,
  b.deleted_at,
  b.deleted_by,
  COUNT(DISTINCT bc.id) AS component_count,
  COUNT(DISTINCT bo.id) AS operation_count
`;

const componentColumns = `
  bc.id,
  bc.bom_id,
  bc.component_product_id,
  p.reference AS component_product_reference,
  p.name AS component_product_name,
  bc.to_consume_qty,
  bc.unit,
  bc.created_at,
  bc.updated_at
`;

const operationColumns = `
  bo.id,
  bo.bom_id,
  bo.operation_name,
  bo.work_center_id,
  wc.name AS work_center_name,
  bo.expected_duration_minutes,
  bo.sequence_no,
  bo.created_at,
  bo.updated_at
`;

async function list(filters = {}) {
  const where = ['b.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(b.reference LIKE ? OR p.name LIKE ? OR p.reference LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.finished_product_id) {
    where.push('b.finished_product_id = ?');
    values.push(filters.finished_product_id);
  }

  if (filters.bom_filter === 'components') {
    where.push('EXISTS (SELECT 1 FROM bom_components bc2 WHERE bc2.bom_id = b.id AND bc2.deleted_at IS NULL)');
    where.push('NOT EXISTS (SELECT 1 FROM bom_operations bo2 WHERE bo2.bom_id = b.id AND bo2.deleted_at IS NULL)');
  } else if (filters.bom_filter === 'operations') {
    where.push('EXISTS (SELECT 1 FROM bom_operations bo2 WHERE bo2.bom_id = b.id AND bo2.deleted_at IS NULL)');
  }

  const { limit, offset, page } = parsePagination(filters);
  const orderBy = resolveSort(filters, BOM_SORT_COLUMNS, 'created_at');

  const [rows] = await pool.query(
    `SELECT ${bomColumns}
     FROM boms b
     INNER JOIN products p ON p.id = b.finished_product_id
     LEFT JOIN bom_components bc ON bc.bom_id = b.id
       AND bc.deleted_at IS NULL
     LEFT JOIN bom_operations bo ON bo.bom_id = b.id
       AND bo.deleted_at IS NULL
     WHERE ${where.join(' AND ')}
     GROUP BY b.id
     ORDER BY ${orderBy}, b.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(DISTINCT b.id) AS total
     FROM boms b
     INNER JOIN products p ON p.id = b.finished_product_id
     WHERE ${where.join(' AND ')}`,
    values
  );

  const tabCounts = await getTabCounts(filters);

  return { rows, pagination: buildPaginationMeta(total, page, limit), tab_counts: tabCounts };
}

async function getTabCounts(filters = {}) {
  const where = ['b.deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(b.reference LIKE ? OR p.name LIKE ? OR p.reference LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.finished_product_id) {
    where.push('b.finished_product_id = ?');
    values.push(filters.finished_product_id);
  }

  const [[counts]] = await pool.query(
    `SELECT
      COUNT(*) AS \`All\`,
      SUM(t.component_count > 0 AND t.operation_count = 0) AS \`Components\`,
      SUM(t.operation_count > 0) AS \`Operations\`
     FROM (
       SELECT b.id, COUNT(DISTINCT bc.id) AS component_count, COUNT(DISTINCT bo.id) AS operation_count
       FROM boms b
       INNER JOIN products p ON p.id = b.finished_product_id
       LEFT JOIN bom_components bc ON bc.bom_id = b.id
         AND bc.deleted_at IS NULL
       LEFT JOIN bom_operations bo ON bo.bom_id = b.id
         AND bo.deleted_at IS NULL
       WHERE ${where.join(' AND ')}
       GROUP BY b.id
     ) t`,
    values
  );

  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value || 0)]));
}

async function findComponentsByBomId(bomId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${componentColumns}
     FROM bom_components bc
     INNER JOIN products p ON p.id = bc.component_product_id
     WHERE bc.bom_id = ?
       AND bc.deleted_at IS NULL
     ORDER BY bc.id`,
    [bomId]
  );

  return rows;
}

async function findOperationsByBomId(bomId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${operationColumns}
     FROM bom_operations bo
     INNER JOIN work_centers wc ON wc.id = bo.work_center_id
     WHERE bo.bom_id = ?
       AND bo.deleted_at IS NULL
     ORDER BY bo.sequence_no, bo.id`,
    [bomId]
  );

  return rows;
}

async function findById(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${bomColumns}
     FROM boms b
     INNER JOIN products p ON p.id = b.finished_product_id
     LEFT JOIN bom_components bc ON bc.bom_id = b.id
       AND bc.deleted_at IS NULL
     LEFT JOIN bom_operations bo ON bo.bom_id = b.id
       AND bo.deleted_at IS NULL
     WHERE b.id = ?
       AND b.deleted_at IS NULL
     GROUP BY b.id
     LIMIT 1`,
    [id]
  );

  const bom = rows[0];

  if (!bom) {
    return null;
  }

  const [components, operations] = await Promise.all([
    findComponentsByBomId(id, connection),
    findOperationsByBomId(id, connection)
  ]);

  return { ...bom, components, operations };
}

async function assertBomExists(id, connection = pool) {
  const bom = await findById(id, connection);

  if (!bom) {
    throw new AppError('Bill of Materials not found', 404);
  }

  return bom;
}

async function assertProductsExist(productIds, connection) {
  const uniqueProductIds = [...new Set(productIds.map((id) => Number(id)))];

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
  const uniqueWorkCenterIds = [...new Set(workCenterIds.map((id) => Number(id)))];

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

async function replaceComponents(bomId, components = [], connection) {
  await connection.execute(
    `UPDATE bom_components
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE bom_id = ?
       AND deleted_at IS NULL`,
    [bomId]
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
      `INSERT INTO bom_components (
        bom_id,
        component_product_id,
        to_consume_qty,
        unit
      ) VALUES (?, ?, ?, ?)`,
      [
        bomId,
        component.component_product_id,
        component.to_consume_qty,
        component.unit || 'Units'
      ]
    );
  }
}

async function replaceOperations(bomId, operations = [], connection) {
  await connection.execute(
    `UPDATE bom_operations
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE bom_id = ?
       AND deleted_at IS NULL`,
    [bomId]
  );

  if (!operations.length) {
    return;
  }

  await assertWorkCentersExist(
    operations.map((operation) => operation.work_center_id),
    connection
  );

  for (const [index, operation] of operations.entries()) {
    await connection.execute(
      `INSERT INTO bom_operations (
        bom_id,
        operation_name,
        work_center_id,
        expected_duration_minutes,
        sequence_no
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        bomId,
        operation.operation_name,
        operation.work_center_id,
        operation.expected_duration_minutes || 0,
        operation.sequence_no || index + 1
      ]
    );
  }
}

async function create(payload, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await assertProductsExist([payload.finished_product_id], connection);

    const reference = await generateReference('bill_of_materials', connection);
    const [result] = await connection.execute(
      `INSERT INTO boms (
        reference,
        finished_product_id,
        quantity,
        unit,
        created_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        reference,
        payload.finished_product_id,
        payload.quantity || 1,
        payload.unit || 'Units',
        userId
      ]
    );

    await replaceComponents(result.insertId, payload.components || [], connection);
    await replaceOperations(result.insertId, payload.operations || [], connection);
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
    await assertBomExists(id, connection);

    if (payload.finished_product_id) {
      await assertProductsExist([payload.finished_product_id], connection);
    }

    const updates = [];
    const values = [];

    for (const field of ['finished_product_id', 'quantity', 'unit']) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updates.push(`${field} = ?`);
        values.push(payload[field] || (field === 'quantity' ? 1 : 'Units'));
      }
    }

    if (updates.length) {
      values.push(id);
      await connection.execute(
        `UPDATE boms
         SET ${updates.join(', ')}
         WHERE id = ?
           AND deleted_at IS NULL`,
        values
      );
    }

    if (payload.components) {
      await replaceComponents(id, payload.components, connection);
    }

    if (payload.operations) {
      await replaceOperations(id, payload.operations, connection);
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

async function softDelete(id, userId, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE boms
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [userId, id]
  );

  return result.affectedRows > 0;
}

async function listWorkCenters(filters = {}) {
  const where = ['deleted_at IS NULL'];
  const values = [];

  if (filters.search) {
    where.push('(name LIKE ? OR description LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);

  const [rows] = await pool.query(
    `SELECT id, name, description, created_at, updated_at
     FROM work_centers
     WHERE ${where.join(' AND ')}
     ORDER BY name
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

async function createWorkCenter(payload) {
  const [result] = await pool.execute(
    `INSERT INTO work_centers (name, description)
     VALUES (?, ?)`,
    [payload.name, payload.description || null]
  );

  return result.insertId;
}

async function findWorkCenterById(id) {
  const [rows] = await pool.execute(
    `SELECT id, name, description, created_at, updated_at
     FROM work_centers
     WHERE id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

module.exports = {
  create,
  createWorkCenter,
  findById,
  findWorkCenterById,
  list,
  listWorkCenters,
  softDelete,
  update
};
