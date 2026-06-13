const { pool } = require('../config/database');
const userModel = require('./user.model');

async function createUserWithRoles(payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO users (
        login_id,
        email,
        password_hash,
        full_name,
        address,
        mobile_number,
        position
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.login_id,
        payload.email,
        payload.password_hash,
        payload.full_name,
        payload.address || null,
        payload.mobile_number || null,
        payload.position || null
      ]
    );

    const userId = result.insertId;

    if (payload.role_codes && payload.role_codes.length > 0) {
      const placeholders = payload.role_codes.map(() => '?').join(', ');
      const [roles] = await connection.execute(
        `SELECT id, code, name FROM roles WHERE code IN (${placeholders}) AND deleted_at IS NULL`,
        payload.role_codes
      );

      if (roles.length !== payload.role_codes.length) {
        throw new Error('One or more selected roles do not exist');
      }

      await connection.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ?',
        [roles.map((role) => [userId, role.id])]
      );
    }

    await connection.commit();

    return userModel.findByIdWithRoles(userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createUserWithRoles
};
