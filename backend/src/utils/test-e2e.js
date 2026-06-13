process.env.ALLOW_ADMIN_SIGNUP = 'true';
process.env.DB_NAME = 'mini_erp';

const app = require('c:/Users/EI/Desktop/MINI ERP/backend/src/app');
const http = require('http');
const { pool } = require('c:/Users/EI/Desktop/MINI ERP/backend/src/config/database');

// Clean database between tests to make it repeatable
async function cleanDatabase() {
  const tables = [
    'audit_logs',
    'stock_ledger',
    'sales_order_items',
    'sales_orders',
    'purchase_order_items',
    'purchase_orders',
    'manufacturing_order_components',
    'manufacturing_order_work_orders',
    'manufacturing_orders',
    'bom_components',
    'bom_operations',
    'boms',
    'products',
    'vendors',
    'customers',
    'user_roles',
    'users'
  ];

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await pool.query(`TRUNCATE TABLE ${table}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  // Re-seed system data that was truncated
  await pool.query(`
    INSERT INTO reference_sequences (code, prefix, next_number, padding_length) VALUES
    ('sales_order', 'SO-', 1, 6),
    ('purchase_order', 'PO-', 1, 6),
    ('manufacturing_order', 'MO-', 1, 6),
    ('bill_of_materials', 'BOM-', 1, 6),
    ('product', 'PROD-', 1, 6)
    ON DUPLICATE KEY UPDATE next_number = 1
  `);
}

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;
  console.log(`Ephemeral test server started on port ${port}`);

  try {
    console.log('Cleaning test database...');
    await cleanDatabase();

    // 1. Admin Sign Up
    console.log('Testing Admin Sign Up...');
    const adminSignupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: 'admin_test',
        email: 'admin_test@test.com',
        password: 'AdminPassword123!',
        full_name: 'Admin Test User',
        role_codes: ['admin']
      })
    });
    const adminSignupData = await adminSignupRes.json();
    if (!adminSignupData.success) {
      throw new Error(`Admin signup failed: ${JSON.stringify(adminSignupData)}`);
    }
    const adminToken = adminSignupData.data.access_token;
    const adminUserId = adminSignupData.data.user.id;
    console.log('Admin user signed up successfully. Token acquired.');

    // 2. Sales User Sign Up
    console.log('Testing Sales User Sign Up...');
    const salesSignupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: 'sales_test',
        email: 'sales_test@test.com',
        password: 'SalesPassword123!',
        full_name: 'Sales Test User',
        role_codes: ['sales_user']
      })
    });
    const salesSignupData = await salesSignupRes.json();
    if (!salesSignupData.success) {
      throw new Error(`Sales User signup failed: ${JSON.stringify(salesSignupData)}`);
    }
    const salesToken = salesSignupData.data.access_token;
    const salesUserId = salesSignupData.data.user.id;
    console.log('Sales user signed up successfully.');

    // 3. User Management tests
    console.log('Testing GET /api/users...');
    const listUsersRes = await fetch(`${baseUrl}/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const listUsersData = await listUsersRes.json();
    if (!listUsersData.success || listUsersData.data.users.length !== 2) {
      throw new Error(`Listing users failed: ${JSON.stringify(listUsersData)}`);
    }
    console.log(`Listed ${listUsersData.data.users.length} users successfully.`);

    // Test Self-Update
    console.log('Testing self profile update (Sales User updates name)...');
    const updateSelfRes = await fetch(`${baseUrl}/users/${salesUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${salesToken}`
      },
      body: JSON.stringify({
        full_name: 'Updated Sales Name'
      })
    });
    const updateSelfData = await updateSelfRes.json();
    if (!updateSelfData.success || updateSelfData.data.user.full_name !== 'Updated Sales Name') {
      throw new Error(`Self update failed: ${JSON.stringify(updateSelfData)}`);
    }
    console.log('Self update succeeded.');

    // Test Self-Update restricted field (Sales User tries to update role)
    console.log('Testing self profile update restriction (Sales User tries to set roles)...');
    const updateSelfRestrictedRes = await fetch(`${baseUrl}/users/${salesUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${salesToken}`
      },
      body: JSON.stringify({
        role_codes: ['admin']
      })
    });
    const updateSelfRestrictedData = await updateSelfRestrictedRes.json();
    if (updateSelfRestrictedRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for role update, got ${updateSelfRestrictedRes.status}: ${JSON.stringify(updateSelfRestrictedData)}`);
    }
    console.log('Self role update correctly rejected with 403.');

    // Test Admin updates standard user position
    console.log('Testing Admin updating Sales User position and status...');
    const updateByAdminRes = await fetch(`${baseUrl}/users/${salesUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        position: 'Sales Lead',
        role_codes: ['sales_user', 'inventory_manager']
      })
    });
    const updateByAdminData = await updateByAdminRes.json();
    if (!updateByAdminData.success || updateByAdminData.data.user.position !== 'Sales Lead' || updateByAdminData.data.user.roles.length !== 2) {
      throw new Error(`Admin update of user failed: ${JSON.stringify(updateByAdminData)}`);
    }
    console.log('Admin successfully updated Sales User position and roles.');

    // 4. MTO Procurement Automation tests
    console.log('Creating Vendor...');
    const createVendorRes = await fetch(`${baseUrl}/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Shiv Wood Suppliers',
        email: 'shivwood@suppliers.com',
        mobile_number: '9988776655',
        address: 'Wood Market, Gujarat'
      })
    });
    const createVendorData = await createVendorRes.json();
    const vendorId = createVendorData.data.vendor.id;

    console.log('Creating Customer...');
    const createCustomerRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Rahul Furniture Showroom',
        email: 'rahul@showroom.com',
        mobile_number: '9876543210',
        address: 'Commercial Street, Ahmedabad'
      })
    });
    const createCustomerData = await createCustomerRes.json();
    const customerId = createCustomerData.data.customer.id;

    console.log('Creating Procure-on-demand Product (MTO Purchase)...');
    const createProductRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'MTO Wooden Chair Legs',
        sales_price: 15.00,
        cost_price: 5.00,
        on_hand_qty: 10,
        procure_on_demand: true,
        procurement_method: 'purchase',
        vendor_id: vendorId
      })
    });
    const createProductData = await createProductRes.json();
    if (!createProductData.success) {
      throw new Error(`Product creation failed: ${JSON.stringify(createProductData)}`);
    }
    const productId = createProductData.data.product.id;
    console.log('Procure-on-demand product created.');

    console.log('Creating Sales Order with quantity exceeding stock (Order: 15, Stock: 10, Shortage: 5)...');
    const createSoRes = await fetch(`${baseUrl}/sales-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        customer_id: customerId,
        sales_person_id: salesUserId,
        scheduled_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        items: [
          {
            product_id: productId,
            ordered_qty: 15,
            sales_unit_price: 15.00
          }
        ]
      })
    });
    const createSoData = await createSoRes.json();
    if (!createSoData.success) {
      throw new Error(`Sales Order creation failed: ${JSON.stringify(createSoData)}`);
    }
    const salesOrderId = createSoData.data.sales_order.id;
    console.log(`Sales Order created in Draft. Reference: ${createSoData.data.sales_order.reference}`);

    console.log('Confirming Sales Order to trigger MTO procurement...');
    const confirmSoRes = await fetch(`${baseUrl}/sales-orders/${salesOrderId}/confirm`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const confirmSoData = await confirmSoRes.json();
    if (!confirmSoData.success) {
      throw new Error(`Confirming Sales Order failed: ${JSON.stringify(confirmSoData)}`);
    }
    console.log('Sales Order confirmed successfully.');

    console.log('Checking if automatic Purchase Order was created for the shortage of 5...');
    const listPosRes = await fetch(`${baseUrl}/purchase-orders`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const listPosData = await listPosRes.json();
    const relatedPos = listPosData.data.purchase_orders.filter(po => Number(po.source_sales_order_id) === salesOrderId);
    if (relatedPos.length !== 1) {
      throw new Error(`Expected exactly 1 related Purchase Order, found ${relatedPos.length}. Data: ${JSON.stringify(listPosData)}`);
    }
    const generatedPo = relatedPos[0];
    console.log(`Found automatically created PO: ${generatedPo.reference} (Source SO: ${generatedPo.source_sales_order_reference})`);

    // Fetch PO items to verify shortage qty
    const getPoRes = await fetch(`${baseUrl}/purchase-orders/${generatedPo.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getPoData = await getPoRes.json();
    const poItem = getPoData.data.purchase_order.items[0];
    console.log(`PO Item: ${poItem.product_name}, Ordered Qty in PO: ${poItem.ordered_qty} (Expected shortage: 5.000)`);
    if (Number(poItem.ordered_qty) !== 5) {
      throw new Error(`Expected PO ordered quantity to be 5, but got ${poItem.ordered_qty}`);
    }
    console.log('Make-To-Order procurement automation test passed!');

    // 5. Audit Log tests
    console.log('Testing Audit Log endpoints...');
    const auditLogsRes = await fetch(`${baseUrl}/audit-logs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const auditLogsData = await auditLogsRes.json();
    if (!auditLogsData.success || auditLogsData.data.audit_logs.length === 0) {
      throw new Error(`Expected audit logs to be logged, got: ${JSON.stringify(auditLogsData)}`);
    }
    console.log(`Retrieved ${auditLogsData.data.audit_logs.length} audit logs.`);

    const auditStatsRes = await fetch(`${baseUrl}/audit-logs/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const auditStatsData = await auditStatsRes.json();
    console.log('Audit Stats:', auditStatsData.data);
    if (!auditStatsData.success || Number(auditStatsData.data.total) === 0) {
      throw new Error(`Expected total stats count > 0, got: ${JSON.stringify(auditStatsData)}`);
    }
    console.log('Audit Log endpoints test passed!');

    console.log('================================================');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY! E2E RUN PASSED');
    console.log('================================================');
    process.exit(0);

  } catch (error) {
    console.error('============================');
    console.error('VERIFICATION TEST FAILED:');
    console.error(error);
    console.error('============================');
    process.exit(1);
  } finally {
    server.close();
  }
});
