const { pool } = require('../config/database');
const userModel = require('./user.model');

async function createUserWithRoles(payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const roleString = (payload.role_codes && payload.role_codes.length > 0) 
      ? payload.role_codes.join(',') 
      : 'sales_user';

    const [result] = await connection.execute(
      `INSERT INTO users (
        login_id,
        email,
        password_hash,
        full_name,
        address,
        mobile_number,
        position,
        roles
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.login_id,
        payload.email,
        payload.password_hash,
        payload.full_name,
        payload.address || null,
        payload.mobile_number || null,
        payload.position || null,
        roleString
      ]
    );

    const userId = result.insertId;
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
