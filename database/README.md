# Mini ERP MySQL Database

Run `mini_erp_mysql_schema.sql` in DBeaver against a MySQL 8+ connection.

The script creates:

- Core ERP tables for users, products, sales, purchase, manufacturing, BoM, inventory, and audit logs.
- Multi-role access using `users`, `roles`, and `user_roles`.
- Fixed default module and field permissions using seed data.
- Soft-delete columns using `deleted_at` and `deleted_by`.
- `product_inventory_summary` view for corrected inventory logic:

```text
Free To Use Qty = On Hand Qty - Reserved Qty
Reserved Qty = open sales quantities + open manufacturing component quantities
```

Reference values such as `SO-000001`, `PO-000001`, `MO-000001`, and `BOM-000001` are stored as normal `VARCHAR(20)` values. The backend should generate the next sequence when creating records.
