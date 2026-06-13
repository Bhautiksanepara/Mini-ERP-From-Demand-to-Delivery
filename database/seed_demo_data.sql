USE mini_erp;

SET @demo_password_hash = '$2b$12$qqSxjeEkqxOJ.NQMQ4dQwe.rpjrn.1Oo5x7ufb.ojHHaHjFF99VaW';

INSERT INTO users (
  login_id,
  email,
  password_hash,
  full_name,
  address,
  mobile_number,
  position,
  is_active
) VALUES
('admin01', 'admin@minierp.local', @demo_password_hash, 'Admin User', 'Mumbai, Maharashtra', '+919000000001', 'System Administrator', TRUE),
('sales01', 'sales@minierp.local', @demo_password_hash, 'Ravi Jadeja', 'Pune, Maharashtra', '+919000000002', 'Sales Manager', TRUE),
('purch01', 'purchase@minierp.local', @demo_password_hash, 'Vijay Sharma', 'Nashik, Maharashtra', '+919000000003', 'Purchase Manager', TRUE),
('mfg001', 'manufacturing@minierp.local', @demo_password_hash, 'Meera Singh', 'Thane, Maharashtra', '+919000000004', 'Manufacturing Lead', TRUE),
('inv001', 'inventory@minierp.local', @demo_password_hash, 'Amit Patil', 'Nagpur, Maharashtra', '+919000000005', 'Inventory Manager', TRUE),
('owner1', 'owner@minierp.local', @demo_password_hash, 'Ananya Rao', 'Bengaluru, Karnataka', '+919000000006', 'Business Owner', TRUE)
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  full_name = VALUES(full_name),
  address = VALUES(address),
  mobile_number = VALUES(mobile_number),
  position = VALUES(position),
  is_active = VALUES(is_active);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'admin'
WHERE u.login_id = 'admin01';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'sales_user'
WHERE u.login_id = 'sales01';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'purchase_user'
WHERE u.login_id = 'purch01';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'manufacturing_user'
WHERE u.login_id = 'mfg001';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'inventory_manager'
WHERE u.login_id = 'inv001';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'business_owner'
WHERE u.login_id = 'owner1';

INSERT INTO customers (name, address, email, mobile_number, created_by)
SELECT 'Suzuki India', 'Mumbai, Maharashtra', 'orders@suzuki.example', '+918000000001', (SELECT id FROM users WHERE login_id = 'admin01')
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE name = 'Suzuki India' AND deleted_at IS NULL);

INSERT INTO customers (name, address, email, mobile_number, created_by)
SELECT 'MRF Ltd.', 'Chennai, Tamil Nadu', 'purchase@mrf.example', '+918000000002', (SELECT id FROM users WHERE login_id = 'admin01')
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE name = 'MRF Ltd.' AND deleted_at IS NULL);

INSERT INTO customers (name, address, email, mobile_number, created_by)
SELECT 'Urban Homes', 'Bengaluru, Karnataka', 'procurement@urbanhomes.example', '+918000000003', (SELECT id FROM users WHERE login_id = 'admin01')
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE name = 'Urban Homes' AND deleted_at IS NULL);

UPDATE customers
SET address = 'Mumbai, Maharashtra', email = 'orders@suzuki.example', mobile_number = '+918000000001'
WHERE name = 'Suzuki India' AND deleted_at IS NULL;

UPDATE customers
SET address = 'Chennai, Tamil Nadu', email = 'purchase@mrf.example', mobile_number = '+918000000002'
WHERE name = 'MRF Ltd.' AND deleted_at IS NULL;

UPDATE customers
SET address = 'Bengaluru, Karnataka', email = 'procurement@urbanhomes.example', mobile_number = '+918000000003'
WHERE name = 'Urban Homes' AND deleted_at IS NULL;

INSERT INTO vendors (name, address, email, mobile_number, created_by)
SELECT 'Plastofact IN', 'Nashik, Maharashtra', 'sales@plastofact.example', '+918000000011', (SELECT id FROM users WHERE login_id = 'admin01')
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Plastofact IN' AND deleted_at IS NULL);

INSERT INTO vendors (name, address, email, mobile_number, created_by)
SELECT 'ORM Metals', 'Pune, Maharashtra', 'orders@ormmetals.example', '+918000000012', (SELECT id FROM users WHERE login_id = 'admin01')
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'ORM Metals' AND deleted_at IS NULL);

INSERT INTO vendors (name, address, email, mobile_number, created_by)
SELECT 'Woodcraft Supply Co', 'Mysuru, Karnataka', 'support@woodcraft.example', '+918000000013', (SELECT id FROM users WHERE login_id = 'admin01')
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'Woodcraft Supply Co' AND deleted_at IS NULL);

UPDATE vendors
SET address = 'Nashik, Maharashtra', email = 'sales@plastofact.example', mobile_number = '+918000000011'
WHERE name = 'Plastofact IN' AND deleted_at IS NULL;

UPDATE vendors
SET address = 'Pune, Maharashtra', email = 'orders@ormmetals.example', mobile_number = '+918000000012'
WHERE name = 'ORM Metals' AND deleted_at IS NULL;

UPDATE vendors
SET address = 'Mysuru, Karnataka', email = 'support@woodcraft.example', mobile_number = '+918000000013'
WHERE name = 'Woodcraft Supply Co' AND deleted_at IS NULL;

INSERT INTO work_centers (name, description) VALUES
('Assembly Line', 'Main furniture assembly area'),
('Paint Floor', 'Painting and finishing area'),
('Packaging Unit', 'Final inspection and packing area')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

INSERT INTO products (
  reference,
  name,
  sales_price,
  cost_price,
  on_hand_qty,
  procure_on_demand,
  procurement_method,
  vendor_id,
  bom_id,
  created_by
) VALUES
('PROD-000001', 'Dining Table', 6000.00, 3200.00, 5.000, FALSE, NULL, NULL, NULL, (SELECT id FROM users WHERE login_id = 'admin01')),
('PROD-000002', 'Drawer Unit', 2500.00, 1400.00, 3.000, FALSE, NULL, NULL, NULL, (SELECT id FROM users WHERE login_id = 'admin01')),
('PROD-000003', 'Wooden Legs', 250.00, 120.00, 80.000, FALSE, 'purchase', (SELECT id FROM vendors WHERE name = 'Woodcraft Supply Co'), NULL, (SELECT id FROM users WHERE login_id = 'admin01')),
('PROD-000004', 'Wooden Top', 900.00, 500.00, 30.000, FALSE, 'purchase', (SELECT id FROM vendors WHERE name = 'Woodcraft Supply Co'), NULL, (SELECT id FROM users WHERE login_id = 'admin01')),
('PROD-000005', 'Screws Pack', 60.00, 25.00, 200.000, FALSE, 'purchase', (SELECT id FROM vendors WHERE name = 'ORM Metals'), NULL, (SELECT id FROM users WHERE login_id = 'admin01')),
('PROD-000006', 'Drawer Handle', 120.00, 55.00, 40.000, FALSE, 'purchase', (SELECT id FROM vendors WHERE name = 'Plastofact IN'), NULL, (SELECT id FROM users WHERE login_id = 'admin01')),
('PROD-000007', 'Lighting Frame', 2000.00, 950.00, 12.000, TRUE, 'purchase', (SELECT id FROM vendors WHERE name = 'ORM Metals'), NULL, (SELECT id FROM users WHERE login_id = 'admin01'))
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sales_price = VALUES(sales_price),
  cost_price = VALUES(cost_price),
  on_hand_qty = VALUES(on_hand_qty),
  procure_on_demand = VALUES(procure_on_demand),
  procurement_method = VALUES(procurement_method),
  vendor_id = VALUES(vendor_id);

INSERT INTO boms (
  reference,
  finished_product_id,
  quantity,
  unit,
  created_by
) VALUES
('BOM-000001', (SELECT id FROM products WHERE reference = 'PROD-000001'), 1.000, 'Units', (SELECT id FROM users WHERE login_id = 'admin01')),
('BOM-000002', (SELECT id FROM products WHERE reference = 'PROD-000002'), 1.000, 'Units', (SELECT id FROM users WHERE login_id = 'admin01'))
ON DUPLICATE KEY UPDATE
  finished_product_id = VALUES(finished_product_id),
  quantity = VALUES(quantity),
  unit = VALUES(unit);

UPDATE products
SET procure_on_demand = TRUE,
    procurement_method = 'manufacturing',
    bom_id = (SELECT id FROM boms WHERE reference = 'BOM-000001')
WHERE reference = 'PROD-000001';

UPDATE products
SET procure_on_demand = TRUE,
    procurement_method = 'manufacturing',
    bom_id = (SELECT id FROM boms WHERE reference = 'BOM-000002')
WHERE reference = 'PROD-000002';

DELETE bc
FROM bom_components bc
JOIN boms b ON b.id = bc.bom_id
WHERE b.reference IN ('BOM-000001', 'BOM-000002');

INSERT INTO bom_components (bom_id, component_product_id, to_consume_qty, unit) VALUES
((SELECT id FROM boms WHERE reference = 'BOM-000001'), (SELECT id FROM products WHERE reference = 'PROD-000003'), 4.000, 'Units'),
((SELECT id FROM boms WHERE reference = 'BOM-000001'), (SELECT id FROM products WHERE reference = 'PROD-000004'), 1.000, 'Units'),
((SELECT id FROM boms WHERE reference = 'BOM-000001'), (SELECT id FROM products WHERE reference = 'PROD-000005'), 1.000, 'Packs'),
((SELECT id FROM boms WHERE reference = 'BOM-000002'), (SELECT id FROM products WHERE reference = 'PROD-000004'), 1.000, 'Units'),
((SELECT id FROM boms WHERE reference = 'BOM-000002'), (SELECT id FROM products WHERE reference = 'PROD-000005'), 1.000, 'Packs'),
((SELECT id FROM boms WHERE reference = 'BOM-000002'), (SELECT id FROM products WHERE reference = 'PROD-000006'), 2.000, 'Units');

DELETE bo
FROM bom_operations bo
JOIN boms b ON b.id = bo.bom_id
WHERE b.reference IN ('BOM-000001', 'BOM-000002');

INSERT INTO bom_operations (
  bom_id,
  operation_name,
  work_center_id,
  expected_duration_minutes,
  sequence_no
) VALUES
((SELECT id FROM boms WHERE reference = 'BOM-000001'), 'Assembly', (SELECT id FROM work_centers WHERE name = 'Assembly Line'), 60.00, 1),
((SELECT id FROM boms WHERE reference = 'BOM-000001'), 'Painting', (SELECT id FROM work_centers WHERE name = 'Paint Floor'), 30.00, 2),
((SELECT id FROM boms WHERE reference = 'BOM-000001'), 'Packing', (SELECT id FROM work_centers WHERE name = 'Packaging Unit'), 20.00, 3),
((SELECT id FROM boms WHERE reference = 'BOM-000002'), 'Assembly', (SELECT id FROM work_centers WHERE name = 'Assembly Line'), 35.00, 1),
((SELECT id FROM boms WHERE reference = 'BOM-000002'), 'Packing', (SELECT id FROM work_centers WHERE name = 'Packaging Unit'), 15.00, 2);

DELETE FROM stock_ledger
WHERE note LIKE 'Seed opening balance:%';

INSERT INTO stock_ledger (
  product_id,
  movement_type,
  quantity_before,
  quantity_change,
  quantity_after,
  movement_direction,
  reference_type,
  reference_id,
  note,
  created_by
)
SELECT
  p.id,
  'manual_adjustment',
  0.000,
  p.on_hand_qty,
  p.on_hand_qty,
  'IN',
  'Opening Balance',
  p.id,
  CONCAT('Seed opening balance: ', p.reference),
  (SELECT id FROM users WHERE login_id = 'admin01')
FROM products p
WHERE p.reference IN (
  'PROD-000001',
  'PROD-000002',
  'PROD-000003',
  'PROD-000004',
  'PROD-000005',
  'PROD-000006',
  'PROD-000007'
);

UPDATE reference_sequences
SET next_number = 8
WHERE code = 'product' AND next_number < 8;

UPDATE reference_sequences
SET next_number = 3
WHERE code = 'bill_of_materials' AND next_number < 3;
