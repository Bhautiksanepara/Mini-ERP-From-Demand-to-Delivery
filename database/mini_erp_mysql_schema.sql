CREATE DATABASE IF NOT EXISTS mini_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mini_erp;

CREATE TABLE roles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
);

CREATE TABLE users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  login_id VARCHAR(12) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  address VARCHAR(255),
  mobile_number VARCHAR(20),
  position VARCHAR(100),
  profile_photo LONGBLOB NULL,
  profile_photo_mime VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  roles SET('admin', 'sales_user', 'purchase_user', 'manufacturing_user', 'inventory_manager', 'business_owner') NOT NULL DEFAULT 'sales_user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT chk_users_login_len CHECK (CHAR_LENGTH(login_id) BETWEEN 6 AND 12)
);

CREATE TABLE modules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE actions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE reference_sequences (
  code VARCHAR(20) PRIMARY KEY,
  prefix VARCHAR(10) NOT NULL,
  next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
  padding_length TINYINT UNSIGNED NOT NULL DEFAULT 6,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE module_permissions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  module_id BIGINT UNSIGNED NOT NULL,
  action_id BIGINT UNSIGNED NOT NULL,
  permission ENUM('allowed', 'limited', 'optional', 'denied') NOT NULL DEFAULT 'denied',
  UNIQUE KEY uq_module_permission (role_id, module_id, action_id),
  CONSTRAINT fk_module_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_module_permissions_module FOREIGN KEY (module_id) REFERENCES modules(id),
  CONSTRAINT fk_module_permissions_action FOREIGN KEY (action_id) REFERENCES actions(id)
);

CREATE TABLE fields (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  module_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(80) NOT NULL,
  is_system_computed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uq_fields_module_code (module_id, code),
  CONSTRAINT fk_fields_module FOREIGN KEY (module_id) REFERENCES modules(id)
);

CREATE TABLE field_permissions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  field_id BIGINT UNSIGNED NOT NULL,
  can_create ENUM('allowed', 'limited', 'denied', 'system') NOT NULL DEFAULT 'denied',
  can_view ENUM('allowed', 'limited', 'denied', 'optional') NOT NULL DEFAULT 'denied',
  can_edit ENUM('allowed', 'limited', 'denied', 'system') NOT NULL DEFAULT 'denied',
  can_delete ENUM('allowed', 'limited', 'denied') NOT NULL DEFAULT 'denied',
  UNIQUE KEY uq_field_permission (role_id, field_id),
  CONSTRAINT fk_field_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_field_permissions_field FOREIGN KEY (field_id) REFERENCES fields(id)
);

CREATE TABLE customers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  email VARCHAR(150),
  mobile_number VARCHAR(20),
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_customers_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE TABLE vendors (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  email VARCHAR(150),
  mobile_number VARCHAR(20),
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_vendors_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_vendors_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE TABLE products (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  sales_price DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cost_price DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  on_hand_qty DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  procure_on_demand BOOLEAN NOT NULL DEFAULT FALSE,
  procurement_method ENUM('purchase', 'manufacturing') NULL,
  vendor_id BIGINT UNSIGNED NULL,
  bom_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_products_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_products_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
  CONSTRAINT chk_product_procurement CHECK (
    procure_on_demand = FALSE
    OR (
      procurement_method = 'purchase'
      AND vendor_id IS NOT NULL
    )
    OR (
      procurement_method = 'manufacturing'
      AND bom_id IS NOT NULL
    )
  )
);

CREATE TABLE work_centers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
);

CREATE TABLE boms (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference VARCHAR(20) NOT NULL UNIQUE,
  finished_product_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 1.000,
  unit VARCHAR(30) NOT NULL DEFAULT 'Units',
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_boms_product FOREIGN KEY (finished_product_id) REFERENCES products(id),
  CONSTRAINT fk_boms_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_boms_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
);

ALTER TABLE products
  ADD CONSTRAINT fk_products_bom FOREIGN KEY (bom_id) REFERENCES boms(id);

CREATE TABLE bom_components (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  bom_id BIGINT UNSIGNED NOT NULL,
  component_product_id BIGINT UNSIGNED NOT NULL,
  to_consume_qty DECIMAL(14,3) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'Units',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_bom_components_bom FOREIGN KEY (bom_id) REFERENCES boms(id),
  CONSTRAINT fk_bom_components_product FOREIGN KEY (component_product_id) REFERENCES products(id)
);

CREATE TABLE bom_operations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  bom_id BIGINT UNSIGNED NOT NULL,
  operation_name VARCHAR(120) NOT NULL,
  work_center_id BIGINT UNSIGNED NOT NULL,
  expected_duration_minutes DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sequence_no INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_bom_operations_bom FOREIGN KEY (bom_id) REFERENCES boms(id),
  CONSTRAINT fk_bom_operations_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id)
);

CREATE TABLE sales_orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference VARCHAR(20) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  customer_address VARCHAR(255),
  sales_person_id BIGINT UNSIGNED NOT NULL,
  status ENUM('Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 'Cancelled') NOT NULL DEFAULT 'Draft',
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scheduled_date DATETIME NULL,
  confirmed_at DATETIME NULL,
  delivered_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_sales_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_sales_orders_sales_person FOREIGN KEY (sales_person_id) REFERENCES users(id),
  CONSTRAINT fk_sales_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_sales_orders_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE TABLE sales_order_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  ordered_qty DECIMAL(14,3) NOT NULL,
  delivered_qty DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  sales_unit_price DECIMAL(14,2) NOT NULL,
  line_total DECIMAL(14,2) GENERATED ALWAYS AS (
    CASE
      WHEN delivered_qty > 0 THEN delivered_qty * sales_unit_price
      ELSE ordered_qty * sales_unit_price
    END
  ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_sales_order_items_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_sales_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_sales_item_qty CHECK (ordered_qty > 0 AND delivered_qty >= 0 AND delivered_qty <= ordered_qty)
);

CREATE TABLE purchase_orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference VARCHAR(20) NOT NULL UNIQUE,
  vendor_id BIGINT UNSIGNED NOT NULL,
  vendor_address VARCHAR(255),
  responsible_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('Draft', 'Confirmed', 'Partially Received', 'Fully Received', 'Cancelled') NOT NULL DEFAULT 'Draft',
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scheduled_date DATETIME NULL,
  confirmed_at DATETIME NULL,
  received_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  source_sales_order_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_purchase_orders_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_purchase_orders_responsible FOREIGN KEY (responsible_user_id) REFERENCES users(id),
  CONSTRAINT fk_purchase_orders_source_so FOREIGN KEY (source_sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_purchase_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_purchase_orders_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
);

CREATE TABLE purchase_order_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  ordered_qty DECIMAL(14,3) NOT NULL,
  received_qty DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  cost_price DECIMAL(14,2) NOT NULL,
  line_total DECIMAL(14,2) GENERATED ALWAYS AS (
    CASE
      WHEN received_qty > 0 THEN received_qty * cost_price
      ELSE ordered_qty * cost_price
    END
  ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_purchase_order_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_purchase_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_purchase_item_qty CHECK (ordered_qty > 0 AND received_qty >= 0 AND received_qty <= ordered_qty)
);

CREATE TABLE manufacturing_orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reference VARCHAR(20) NOT NULL UNIQUE,
  schedule_date DATETIME NULL,
  finished_product_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'Units',
  assignee_id BIGINT UNSIGNED NULL,
  bom_id BIGINT UNSIGNED NULL,
  status ENUM('Draft', 'Confirmed', 'In Progress', 'Done', 'Cancelled') NOT NULL DEFAULT 'Draft',
  confirmed_at DATETIME NULL,
  started_at DATETIME NULL,
  produced_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  source_sales_order_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_manufacturing_orders_product FOREIGN KEY (finished_product_id) REFERENCES products(id),
  CONSTRAINT fk_manufacturing_orders_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
  CONSTRAINT fk_manufacturing_orders_bom FOREIGN KEY (bom_id) REFERENCES boms(id),
  CONSTRAINT fk_manufacturing_orders_source_so FOREIGN KEY (source_sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_manufacturing_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_manufacturing_orders_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
  CONSTRAINT chk_mo_qty CHECK (quantity > 0)
);

CREATE TABLE manufacturing_order_components (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  manufacturing_order_id BIGINT UNSIGNED NOT NULL,
  component_product_id BIGINT UNSIGNED NOT NULL,
  to_consume_qty DECIMAL(14,3) NOT NULL,
  consumed_qty DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  unit VARCHAR(30) NOT NULL DEFAULT 'Units',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_mo_components_order FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  CONSTRAINT fk_mo_components_product FOREIGN KEY (component_product_id) REFERENCES products(id),
  CONSTRAINT chk_mo_component_qty CHECK (to_consume_qty >= 0 AND consumed_qty >= 0)
);

CREATE TABLE manufacturing_order_work_orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  manufacturing_order_id BIGINT UNSIGNED NOT NULL,
  operation_name VARCHAR(120) NOT NULL,
  work_center_id BIGINT UNSIGNED NOT NULL,
  expected_duration_minutes DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  real_duration_minutes DECIMAL(12,2) NULL,
  sequence_no INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_mo_work_orders_order FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id),
  CONSTRAINT fk_mo_work_orders_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id)
);

CREATE TABLE stock_ledger (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('sales_delivery', 'purchase_receipt', 'manufacturing_consumption', 'manufacturing_production', 'manual_adjustment') NOT NULL,
  quantity_before DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  quantity_change DECIMAL(14,3) NOT NULL,
  quantity_after DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  movement_direction ENUM('IN', 'OUT') NOT NULL,
  reference_type VARCHAR(60) NOT NULL,
  reference_id BIGINT UNSIGNED NOT NULL,
  note VARCHAR(255),
  created_by BIGINT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_ledger_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_stock_ledger_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  module_code VARCHAR(50) NOT NULL,
  record_type VARCHAR(80) NOT NULL,
  record_id BIGINT UNSIGNED NOT NULL,
  action ENUM('Created', 'Updated', 'Deleted', 'Confirmed', 'Delivered', 'Received', 'Produced', 'Cancelled', 'Started') NOT NULL,
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_audit_logs_filters (module_code, action, created_at),
  INDEX idx_audit_logs_record (record_type, record_id)
);

CREATE OR REPLACE VIEW product_inventory_summary AS
SELECT
  p.id AS product_id,
  p.reference,
  p.name,
  p.on_hand_qty,
  COALESCE(so_reserved.reserved_qty, 0) + COALESCE(mo_reserved.reserved_qty, 0) AS reserved_qty,
  p.on_hand_qty - (COALESCE(so_reserved.reserved_qty, 0) + COALESCE(mo_reserved.reserved_qty, 0)) AS free_to_use_qty
FROM products p
LEFT JOIN (
  SELECT
    soi.product_id,
    SUM(soi.ordered_qty - soi.delivered_qty) AS reserved_qty
  FROM sales_order_items soi
  INNER JOIN sales_orders so ON so.id = soi.sales_order_id
  WHERE so.status IN ('Confirmed', 'Partially Delivered')
    AND so.deleted_at IS NULL
    AND soi.deleted_at IS NULL
  GROUP BY soi.product_id
) so_reserved ON so_reserved.product_id = p.id
LEFT JOIN (
  SELECT
    moc.component_product_id AS product_id,
    SUM(moc.to_consume_qty - moc.consumed_qty) AS reserved_qty
  FROM manufacturing_order_components moc
  INNER JOIN manufacturing_orders mo ON mo.id = moc.manufacturing_order_id
  WHERE mo.status IN ('Confirmed', 'In Progress')
    AND mo.deleted_at IS NULL
    AND moc.deleted_at IS NULL
  GROUP BY moc.component_product_id
) mo_reserved ON mo_reserved.product_id = p.id
WHERE p.deleted_at IS NULL;

INSERT INTO roles (name, code, description, is_system_role) VALUES
('System Administrator', 'admin', 'Full system administrator access', TRUE),
('Sales User', 'sales_user', 'Sales order user', TRUE),
('Purchase User', 'purchase_user', 'Purchase order user', TRUE),
('Manufacturing User', 'manufacturing_user', 'Manufacturing order user', TRUE),
('Inventory Manager', 'inventory_manager', 'Inventory and stock movement user', TRUE),
('Business Owner', 'business_owner', 'Business monitoring user', TRUE);

INSERT INTO modules (name, code) VALUES
('Sales', 'sales'),
('Purchase', 'purchase'),
('Manufacturing', 'manufacturing'),
('Product', 'product'),
('Bill of Materials', 'bom'),
('Inventory', 'inventory'),
('Audit Logs', 'audit_logs'),
('Dashboard', 'dashboard'),
('User Management', 'user_management');

INSERT INTO actions (name, code) VALUES
('View', 'view'),
('Create', 'create'),
('Edit', 'edit'),
('Delete', 'delete'),
('Approve', 'approve'),
('Confirm', 'confirm'),
('Deliver', 'deliver'),
('Receive', 'receive'),
('Production Entry', 'production_entry'),
('Edit BOM', 'edit_bom'),
('Manage Users', 'manage_users');

INSERT INTO reference_sequences (code, prefix, next_number, padding_length) VALUES
('sales_order', 'SO-', 1, 6),
('purchase_order', 'PO-', 1, 6),
('manufacturing_order', 'MO-', 1, 6),
('bill_of_materials', 'BOM-', 1, 6),
('product', 'PROD-', 1, 6);

INSERT INTO module_permissions (role_id, module_id, action_id, permission)
SELECT r.id, m.id, a.id, 'allowed'
FROM roles r
CROSS JOIN modules m
CROSS JOIN actions a
WHERE r.code = 'admin';

INSERT INTO module_permissions (role_id, module_id, action_id, permission)
SELECT r.id, m.id, a.id,
  CASE
    WHEN m.code = 'sales' AND a.code IN ('view', 'create') THEN 'allowed'
    WHEN m.code = 'sales' AND a.code = 'edit' THEN 'limited'
    WHEN m.code IN ('product', 'dashboard') AND a.code = 'view' THEN 'allowed'
    ELSE 'denied'
  END
FROM roles r CROSS JOIN modules m CROSS JOIN actions a
WHERE r.code = 'sales_user';

INSERT INTO module_permissions (role_id, module_id, action_id, permission)
SELECT r.id, m.id, a.id,
  CASE
    WHEN m.code = 'purchase' AND a.code IN ('view', 'create') THEN 'allowed'
    WHEN m.code = 'purchase' AND a.code = 'edit' THEN 'limited'
    WHEN m.code IN ('product', 'dashboard') AND a.code = 'view' THEN 'allowed'
    ELSE 'denied'
  END
FROM roles r CROSS JOIN modules m CROSS JOIN actions a
WHERE r.code = 'purchase_user';

INSERT INTO module_permissions (role_id, module_id, action_id, permission)
SELECT r.id, m.id, a.id,
  CASE
    WHEN m.code = 'manufacturing' AND a.code IN ('view', 'production_entry', 'create') THEN 'allowed'
    WHEN m.code = 'manufacturing' AND a.code = 'edit' THEN 'limited'
    WHEN m.code IN ('bom', 'product', 'dashboard') AND a.code = 'view' THEN 'allowed'
    ELSE 'denied'
  END
FROM roles r CROSS JOIN modules m CROSS JOIN actions a
WHERE r.code = 'manufacturing_user';

INSERT INTO module_permissions (role_id, module_id, action_id, permission)
SELECT r.id, m.id, a.id,
  CASE
    WHEN m.code IN ('inventory', 'product', 'dashboard') AND a.code = 'view' THEN 'allowed'
    WHEN m.code = 'product' AND a.code = 'edit' THEN 'limited'
    ELSE 'denied'
  END
FROM roles r CROSS JOIN modules m CROSS JOIN actions a
WHERE r.code = 'inventory_manager';

INSERT INTO module_permissions (role_id, module_id, action_id, permission)
SELECT r.id, m.id, a.id,
  CASE
    WHEN a.code = 'view' AND m.code IN ('sales', 'purchase', 'manufacturing', 'product', 'bom', 'inventory', 'audit_logs', 'dashboard') THEN 'allowed'
    ELSE 'denied'
  END
FROM roles r CROSS JOIN modules m CROSS JOIN actions a
WHERE r.code = 'business_owner';

INSERT INTO fields (module_id, name, code, is_system_computed)
SELECT m.id, x.name, x.code, x.is_system_computed
FROM modules m
JOIN (
  SELECT 'sales' module_code, 'Customer' name, 'customer' code, FALSE is_system_computed UNION ALL
  SELECT 'sales', 'Customer Address', 'customer_address', FALSE UNION ALL
  SELECT 'sales', 'Sales Person', 'sales_person', FALSE UNION ALL
  SELECT 'sales', 'Product', 'product', FALSE UNION ALL
  SELECT 'sales', 'Ordered Quantity', 'ordered_quantity', FALSE UNION ALL
  SELECT 'sales', 'Delivered Quantity', 'delivered_quantity', FALSE UNION ALL
  SELECT 'sales', 'Sales Price', 'sales_price', FALSE UNION ALL
  SELECT 'sales', 'Status', 'status', TRUE UNION ALL
  SELECT 'sales', 'Total', 'total', TRUE UNION ALL
  SELECT 'sales', 'Creation Date', 'creation_date', TRUE UNION ALL
  SELECT 'purchase', 'Vendor', 'vendor', FALSE UNION ALL
  SELECT 'purchase', 'Vendor Address', 'vendor_address', FALSE UNION ALL
  SELECT 'purchase', 'Responsible Person', 'responsible_person', FALSE UNION ALL
  SELECT 'purchase', 'Product', 'product', FALSE UNION ALL
  SELECT 'purchase', 'Ordered Quantity', 'ordered_quantity', FALSE UNION ALL
  SELECT 'purchase', 'Received Quantity', 'received_quantity', FALSE UNION ALL
  SELECT 'purchase', 'Cost Price', 'cost_price', FALSE UNION ALL
  SELECT 'purchase', 'Total', 'total', TRUE UNION ALL
  SELECT 'purchase', 'Creation Date', 'creation_date', TRUE UNION ALL
  SELECT 'manufacturing', 'Product to Manufacture', 'product_to_manufacture', FALSE UNION ALL
  SELECT 'manufacturing', 'Product Quantity', 'product_quantity', FALSE UNION ALL
  SELECT 'manufacturing', 'BoM', 'bom', FALSE UNION ALL
  SELECT 'manufacturing', 'Responsible Person', 'responsible_person', FALSE UNION ALL
  SELECT 'manufacturing', 'Finished Quantity', 'finished_quantity', FALSE UNION ALL
  SELECT 'manufacturing', 'Creation Date', 'creation_date', TRUE UNION ALL
  SELECT 'bom', 'Reference', 'reference', TRUE UNION ALL
  SELECT 'bom', 'Finished Product', 'finished_product', FALSE UNION ALL
  SELECT 'bom', 'Quantity', 'quantity', FALSE UNION ALL
  SELECT 'bom', 'Components', 'components', FALSE UNION ALL
  SELECT 'bom', 'To Consume Quantity', 'to_consume_quantity', FALSE UNION ALL
  SELECT 'bom', 'Operations', 'operations', FALSE UNION ALL
  SELECT 'bom', 'Work Center', 'work_center', FALSE UNION ALL
  SELECT 'bom', 'Expected Duration', 'expected_duration', FALSE UNION ALL
  SELECT 'product', 'Product', 'product', FALSE UNION ALL
  SELECT 'product', 'Sales Price', 'sales_price', FALSE UNION ALL
  SELECT 'product', 'Cost Price', 'cost_price', FALSE UNION ALL
  SELECT 'product', 'On Hand Qty', 'on_hand_qty', FALSE UNION ALL
  SELECT 'product', 'Free To Use Qty', 'free_to_use_qty', TRUE UNION ALL
  SELECT 'product', 'Procure On Demand', 'procure_on_demand', FALSE UNION ALL
  SELECT 'product', 'Procurement Method', 'procurement_method', FALSE UNION ALL
  SELECT 'product', 'Vendor', 'vendor', FALSE UNION ALL
  SELECT 'product', 'Bill of Materials', 'bom', FALSE
) x ON x.module_code = m.code;

INSERT INTO field_permissions (role_id, field_id, can_create, can_view, can_edit, can_delete)
SELECT r.id, f.id,
  CASE WHEN f.is_system_computed THEN 'system' ELSE 'allowed' END,
  'allowed',
  CASE WHEN f.is_system_computed THEN 'system' ELSE 'allowed' END,
  'allowed'
FROM roles r
CROSS JOIN fields f
WHERE r.code = 'admin';

INSERT INTO field_permissions (role_id, field_id, can_create, can_view, can_edit, can_delete)
SELECT r.id, f.id,
  CASE
    WHEN f.is_system_computed THEN 'system'
    WHEN m.code IN ('sales', 'product') THEN 'allowed'
    ELSE 'denied'
  END,
  CASE WHEN m.code IN ('sales', 'product') THEN 'allowed' ELSE 'denied' END,
  CASE
    WHEN f.is_system_computed THEN 'system'
    WHEN m.code IN ('sales', 'product') THEN 'limited'
    ELSE 'denied'
  END,
  'denied'
FROM roles r CROSS JOIN fields f JOIN modules m ON m.id = f.module_id
WHERE r.code = 'sales_user';

INSERT INTO field_permissions (role_id, field_id, can_create, can_view, can_edit, can_delete)
SELECT r.id, f.id,
  CASE
    WHEN f.is_system_computed THEN 'system'
    WHEN m.code IN ('purchase', 'product') THEN 'allowed'
    ELSE 'denied'
  END,
  CASE WHEN m.code IN ('purchase', 'product') THEN 'allowed' ELSE 'denied' END,
  CASE
    WHEN f.is_system_computed THEN 'system'
    WHEN m.code IN ('purchase', 'product') THEN 'limited'
    ELSE 'denied'
  END,
  'denied'
FROM roles r CROSS JOIN fields f JOIN modules m ON m.id = f.module_id
WHERE r.code = 'purchase_user';

INSERT INTO field_permissions (role_id, field_id, can_create, can_view, can_edit, can_delete)
SELECT r.id, f.id,
  CASE
    WHEN f.is_system_computed THEN 'system'
    WHEN m.code IN ('manufacturing', 'bom', 'product') THEN 'allowed'
    ELSE 'denied'
  END,
  CASE WHEN m.code IN ('manufacturing', 'bom', 'product') THEN 'allowed' ELSE 'denied' END,
  CASE
    WHEN f.is_system_computed THEN 'system'
    WHEN m.code = 'manufacturing' THEN 'limited'
    ELSE 'denied'
  END,
  'denied'
FROM roles r CROSS JOIN fields f JOIN modules m ON m.id = f.module_id
WHERE r.code = 'manufacturing_user';

INSERT INTO field_permissions (role_id, field_id, can_create, can_view, can_edit, can_delete)
SELECT r.id, f.id,
  'denied',
  CASE WHEN m.code IN ('product', 'sales', 'purchase', 'manufacturing') THEN 'allowed' ELSE 'denied' END,
  CASE WHEN m.code = 'product' AND f.code = 'on_hand_qty' THEN 'limited' ELSE 'denied' END,
  'denied'
FROM roles r CROSS JOIN fields f JOIN modules m ON m.id = f.module_id
WHERE r.code = 'inventory_manager';

INSERT INTO field_permissions (role_id, field_id, can_create, can_view, can_edit, can_delete)
SELECT r.id, f.id, 'denied', 'allowed', 'denied', 'denied'
FROM roles r
CROSS JOIN fields f
WHERE r.code = 'business_owner';

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_sales_person ON sales_orders(sales_person_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_responsible ON purchase_orders(responsible_user_id);
CREATE INDEX idx_manufacturing_orders_status ON manufacturing_orders(status);
CREATE INDEX idx_manufacturing_orders_assignee ON manufacturing_orders(assignee_id);
CREATE INDEX idx_stock_ledger_product_created ON stock_ledger(product_id, created_at);
