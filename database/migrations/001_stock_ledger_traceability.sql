USE mini_erp;

ALTER TABLE stock_ledger
  ADD COLUMN quantity_before DECIMAL(14,3) NOT NULL DEFAULT 0.000 AFTER movement_type,
  ADD COLUMN quantity_after DECIMAL(14,3) NOT NULL DEFAULT 0.000 AFTER quantity_change,
  ADD COLUMN movement_direction ENUM('IN', 'OUT') NOT NULL DEFAULT 'IN' AFTER quantity_after;

UPDATE stock_ledger
SET
  quantity_before = 0.000,
  quantity_after = quantity_change,
  movement_direction = CASE WHEN quantity_change < 0 THEN 'OUT' ELSE 'IN' END
WHERE quantity_before = 0.000
  AND quantity_after = 0.000;
