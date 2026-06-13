const { testConnection } = require('../config/database');

async function checkHealth(req, res, next) {
  try {
    await testConnection();

    res.json({
      success: true,
      message: 'Mini ERP API and MySQL connection are healthy'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkHealth
};
