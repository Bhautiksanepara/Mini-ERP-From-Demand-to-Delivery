const { pool } = require('../config/database');
const { parsePagination, resolveSort, buildPaginationMeta } = require('../utils/list-query');

const AUDIT_LOG_SORT_COLUMNS = {
  created_at: 'al.created_at',
  user_name: 'u.full_name',
  module_code: 'al.module_code',
  record_type: 'al.record_type',
  action: 'al.action'
};

async function createAuditLog(payload, connection = pool) {
  const [result] = await connection.execute(
    `INSERT INTO audit_logs (
      user_id,
      module_code,
      record_type,
      record_id,
      action,
      field_changed,
      old_value,
      new_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.user_id || null,
      payload.module_code,
      payload.record_type,
      payload.record_id,
      payload.action,
      payload.field_changed || null,
      payload.old_value === undefined ? null : String(payload.old_value),
      payload.new_value === undefined ? null : String(payload.new_value)
    ]
  );

  return result.insertId;
}

async function createAuditLogs(payloads, connection = pool) {
  if (!payloads.length) {
    return [];
  }

  const ids = [];

  for (const payload of payloads) {
    ids.push(await createAuditLog(payload, connection));
  }

  return ids;
}

async function listAuditLogs(filters = {}) {
  const where = [];
  const values = [];

  if (filters.search) {
    where.push('(u.full_name LIKE ? OR al.module_code LIKE ? OR al.record_type LIKE ? OR al.action LIKE ? OR al.field_changed LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.module_code) {
    where.push('al.module_code = ?');
    values.push(filters.module_code);
  }

  if (filters.user_id) {
    where.push('al.user_id = ?');
    values.push(filters.user_id);
  }

  if (filters.action) {
    where.push('al.action = ?');
    values.push(filters.action);
  }

  if (filters.record_type) {
    where.push('al.record_type = ?');
    values.push(filters.record_type);
  }

  if (filters.start_date) {
    where.push('al.created_at >= ?');
    values.push(filters.start_date);
  }

  if (filters.end_date) {
    where.push('al.created_at <= ?');
    values.push(filters.end_date);
  }

  const { limit, offset, page } = parsePagination(filters);
  const orderBy = resolveSort(filters, AUDIT_LOG_SORT_COLUMNS, 'created_at');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT
      al.id,
      al.user_id,
      u.full_name AS user_name,
      al.module_code,
      al.record_type,
      al.record_id,
      al.action,
      al.field_changed,
      al.old_value,
      al.new_value,
      al.created_at
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}
     ORDER BY ${orderBy}, al.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}`,
    values
  );

  const tabCounts = await getAuditLogTabCounts(filters);

  return { rows, pagination: buildPaginationMeta(total, page, limit), tab_counts: tabCounts };
}

async function getAuditLogTabCounts(filters = {}) {
  const where = [];
  const values = [];

  if (filters.search) {
    where.push('(u.full_name LIKE ? OR al.module_code LIKE ? OR al.record_type LIKE ? OR al.action LIKE ? OR al.field_changed LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.module_code) {
    where.push('al.module_code = ?');
    values.push(filters.module_code);
  }

  if (filters.user_id) {
    where.push('al.user_id = ?');
    values.push(filters.user_id);
  }

  if (filters.record_type) {
    where.push('al.record_type = ?');
    values.push(filters.record_type);
  }

  if (filters.start_date) {
    where.push('al.created_at >= ?');
    values.push(filters.start_date);
  }

  if (filters.end_date) {
    where.push('al.created_at <= ?');
    values.push(filters.end_date);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[counts]] = await pool.query(
    `SELECT
      COUNT(*) AS \`All Modules\`,
      SUM(al.action = 'Created') AS \`Created\`,
      SUM(al.action = 'Updated') AS \`Updated\`,
      SUM(al.action = 'Deleted') AS \`Deleted\`
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}`,
    values
  );

  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value || 0)]));
}

async function getAuditLogStats(filters = {}) {
  const where = [];
  const values = [];

  if (filters.module_code) {
    where.push('module_code = ?');
    values.push(filters.module_code);
  }

  if (filters.user_id) {
    where.push('user_id = ?');
    values.push(filters.user_id);
  }

  if (filters.action) {
    where.push('action = ?');
    values.push(filters.action);
  }

  if (filters.record_type) {
    where.push('record_type = ?');
    values.push(filters.record_type);
  }

  if (filters.start_date) {
    where.push('created_at >= ?');
    values.push(filters.start_date);
  }

  if (filters.end_date) {
    where.push('created_at <= ?');
    values.push(filters.end_date);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN action = 'Created' THEN 1 ELSE 0 END) AS created,
      SUM(CASE WHEN action = 'Updated' THEN 1 ELSE 0 END) AS updated,
      SUM(CASE WHEN action = 'Deleted' THEN 1 ELSE 0 END) AS deleted
     FROM audit_logs
     ${whereSql}`,
    values
  );

  const stats = rows[0];
  return {
    total: Number(stats?.total || 0),
    created: Number(stats?.created || 0),
    updated: Number(stats?.updated || 0),
    deleted: Number(stats?.deleted || 0)
  };
}

module.exports = {
  createAuditLog,
  createAuditLogs,
  listAuditLogs,
  getAuditLogStats
};
