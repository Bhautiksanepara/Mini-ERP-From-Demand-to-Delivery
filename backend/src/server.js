require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/database');

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await testConnection();
    console.log(`MySQL connected on port ${process.env.DB_PORT || 3303}`);
  } catch (error) {
    console.warn('MySQL connection failed. The API will start, but database routes need valid .env credentials.');
    console.warn(error.message);
  }

  app.listen(PORT, () => {
    console.log(`Mini ERP API running on port ${PORT}`);
  });
}

startServer();
