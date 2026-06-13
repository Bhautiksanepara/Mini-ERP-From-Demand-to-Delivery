const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
