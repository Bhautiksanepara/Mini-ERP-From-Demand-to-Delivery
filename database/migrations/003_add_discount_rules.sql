USE mini_erp;

CREATE TABLE IF NOT EXISTS discount_rules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  module_code ENUM('sales_order', 'purchase_order') NOT NULL UNIQUE,
  threshold_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO discount_rules (module_code, threshold_amount, discount_amount, is_active)
SELECT 'sales_order', 0, 0, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM discount_rules WHERE module_code = 'sales_order');

INSERT INTO discount_rules (module_code, threshold_amount, discount_amount, is_active)
SELECT 'purchase_order', 0, 0, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM discount_rules WHERE module_code = 'purchase_order');

ALTER TABLE sales_orders
  ADD COLUMN discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER cancelled_at;

ALTER TABLE purchase_orders
  ADD COLUMN discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER cancelled_at;
