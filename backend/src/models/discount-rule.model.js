const { pool } = require('../config/database');
const { AppError } = require('../utils/app-error');

const discountRuleColumns = `
  id,
  module_code,
  threshold_amount,
  discount_amount,
  is_active,
  created_at,
  updated_at
`;

async function list() {
  const [rows] = await pool.query(
    `SELECT ${discountRuleColumns} FROM discount_rules ORDER BY module_code`
  );

  return rows;
}

async function getRule(moduleCode, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${discountRuleColumns} FROM discount_rules WHERE module_code = ? LIMIT 1`,
    [moduleCode]
  );

  return rows[0] || null;
}

async function update(moduleCode, payload) {
  const updates = [];
  const values = [];

  if (Object.prototype.hasOwnProperty.call(payload, 'threshold_amount')) {
    updates.push('threshold_amount = ?');
    values.push(payload.threshold_amount);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'discount_amount')) {
    updates.push('discount_amount = ?');
    values.push(payload.discount_amount);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) {
    updates.push('is_active = ?');
    values.push(payload.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return getRule(moduleCode);
  }

  values.push(moduleCode);
  const [result] = await pool.execute(
    `UPDATE discount_rules SET ${updates.join(', ')} WHERE module_code = ?`,
    values
  );

  if (result.affectedRows === 0) {
    throw new AppError('Discount rule not found', 404);
  }

  return getRule(moduleCode);
}

async function calculateDiscount(moduleCode, subtotal, connection = pool) {
  const rule = await getRule(moduleCode, connection);

  if (!rule || !rule.is_active) {
    return 0;
  }

  const threshold = Number(rule.threshold_amount);
  const amount = Number(rule.discount_amount);
  const subtotalNumber = Number(subtotal);

  if (threshold <= 0 || subtotalNumber < threshold) {
    return 0;
  }

  return Math.min(amount, subtotalNumber);
}

module.exports = {
  list,
  getRule,
  update,
  calculateDiscount
};
