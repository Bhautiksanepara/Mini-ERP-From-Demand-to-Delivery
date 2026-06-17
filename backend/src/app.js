const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const auditLogRoutes = require('./routes/audit-log.routes');
const authRoutes = require('./routes/auth.routes');
const bomRoutes = require('./routes/bom.routes');
const customerRoutes = require('./routes/customer.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const discountRuleRoutes = require('./routes/discount-rule.routes');
const healthRoutes = require('./routes/health.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const lookupRoutes = require('./routes/lookup.routes');
const manufacturingOrderRoutes = require('./routes/manufacturing-order.routes');
const permissionRoutes = require('./routes/permission.routes');
const productRoutes = require('./routes/product.routes');
const purchaseOrderRoutes = require('./routes/purchase-order.routes');
const salesOrderRoutes = require('./routes/sales-order.routes');
const userRoutes = require('./routes/user.routes');
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
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/api', apiLimiter);

app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/boms', bomRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/discount-rules', discountRuleRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/manufacturing-orders', manufacturingOrderRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
