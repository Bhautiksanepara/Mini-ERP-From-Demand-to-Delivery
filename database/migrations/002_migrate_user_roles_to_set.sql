USE mini_erp;

-- Add roles column to users table
ALTER TABLE users ADD COLUMN roles SET('admin', 'sales_user', 'purchase_user', 'manufacturing_user', 'inventory_manager', 'business_owner') NOT NULL DEFAULT 'sales_user';

-- Populate users.roles from user_roles and roles table
UPDATE users u
SET u.roles = (
  SELECT COALESCE(GROUP_CONCAT(r.code), 'sales_user')
  FROM user_roles ur
  INNER JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = u.id
);

-- Make sure bhautik / sanepa1234 has the 'admin' role assigned
UPDATE users
SET roles = 'admin,inventory_manager'
WHERE login_id = 'sanepa1234';

-- Drop the user_roles join table
DROP TABLE IF EXISTS user_roles;
