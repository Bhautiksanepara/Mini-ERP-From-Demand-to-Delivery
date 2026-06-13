require('dotenv').config();

const app = require('./app');
const { getDatabaseConfigSummary, testConnection } = require('./config/database');

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await testConnection();
    console.log(`MySQL connected on port ${process.env.DB_PORT || 3303}`);
  } catch (error) {
    const dbConfig = getDatabaseConfigSummary();

    console.warn('MySQL connection failed. The API will start, but database routes need valid .env credentials.');
    console.warn(
      `Attempted MySQL connection: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    );
    console.warn(`Reason: ${error.code || error.name} - ${error.message}`);
  }

  const server = app.listen(PORT, () => {
    console.log(`Mini ERP API running on port ${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Set PORT to another value in .env.`);
      process.exit(1);
    }

    throw error;
  });
}

startServer();
