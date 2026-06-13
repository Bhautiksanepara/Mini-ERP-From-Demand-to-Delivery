const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const healthRoutes = require('./routes/health.routes');
const permissionRoutes = require('./routes/permission.routes');
const productRoutes = require('./routes/product.routes');
const vendorRoutes = require('./routes/vendor.routes');
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
app.use('/api/customers', customerRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
