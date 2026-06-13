const { pool } = require('../config/database');

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

  const limit = Math.min(Number(filters.limit || 50), 200);
  const offset = Number(filters.offset || 0);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
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
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return rows;
}

module.exports = {
  createAuditLog,
  createAuditLogs,
  listAuditLogs
};
