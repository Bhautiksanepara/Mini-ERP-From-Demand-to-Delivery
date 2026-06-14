const { pool } = require('../config/database');
const { asyncHandler } = require('../utils/async-handler');

const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const formatCounts = (rows, lateCount, statuses) => {
    const countsObj = {};
    statuses.forEach(status => {
      countsObj[status] = 0;
    });
    rows.forEach(row => {
      // Map database statuses directly to their keys
      let key = row.status;
      if (countsObj[key] !== undefined) {
        countsObj[key] = Number(row.count || 0);
      }
    });
    countsObj['Late'] = Number(lateCount || 0);
    return countsObj;
  };

  // 1. Sales Orders Queries
  const salesStatuses = ['Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered'];
  const [salesAll] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM sales_orders WHERE deleted_at IS NULL GROUP BY status`
  );
  const [salesMy] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM sales_orders WHERE deleted_at IS NULL AND sales_person_id = ? GROUP BY status`,
    [userId]
  );
  const [salesAllLate] = await pool.execute(
    `SELECT COUNT(*) AS count FROM sales_orders 
     WHERE deleted_at IS NULL AND status = 'Confirmed' AND scheduled_date IS NOT NULL AND scheduled_date < CURRENT_TIMESTAMP`
  );
  const [salesMyLate] = await pool.execute(
    `SELECT COUNT(*) AS count FROM sales_orders 
     WHERE deleted_at IS NULL AND status = 'Confirmed' AND sales_person_id = ? AND scheduled_date IS NOT NULL AND scheduled_date < CURRENT_TIMESTAMP`,
    [userId]
  );

  // 2. Purchase Orders Queries
  const purchaseStatuses = ['Draft', 'Confirmed', 'Partially Received', 'Fully Received'];
  const [purchaseAll] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM purchase_orders WHERE deleted_at IS NULL GROUP BY status`
  );
  const [purchaseMy] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM purchase_orders WHERE deleted_at IS NULL AND responsible_user_id = ? GROUP BY status`,
    [userId]
  );
  const [purchaseAllLate] = await pool.execute(
    `SELECT COUNT(*) AS count FROM purchase_orders 
     WHERE deleted_at IS NULL AND status = 'Confirmed' AND scheduled_date IS NOT NULL AND scheduled_date < CURRENT_TIMESTAMP`
  );
  const [purchaseMyLate] = await pool.execute(
    `SELECT COUNT(*) AS count FROM purchase_orders 
     WHERE deleted_at IS NULL AND status = 'Confirmed' AND responsible_user_id = ? AND scheduled_date IS NOT NULL AND scheduled_date < CURRENT_TIMESTAMP`,
    [userId]
  );

  // 3. Manufacturing Orders Queries
  const manufacturingStatuses = ['Draft', 'Confirmed', 'In Progress', 'To Close', 'Done'];
  const [manufacturingAll] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM manufacturing_orders WHERE deleted_at IS NULL GROUP BY status`
  );
  const [manufacturingMy] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM manufacturing_orders WHERE deleted_at IS NULL AND assignee_id = ? GROUP BY status`,
    [userId]
  );
  const [manufacturingAllLate] = await pool.execute(
    `SELECT COUNT(*) AS count FROM manufacturing_orders 
     WHERE deleted_at IS NULL AND status = 'Confirmed' AND schedule_date IS NOT NULL AND schedule_date < CURRENT_TIMESTAMP`
  );
  const [manufacturingMyLate] = await pool.execute(
    `SELECT COUNT(*) AS count FROM manufacturing_orders 
     WHERE deleted_at IS NULL AND status = 'Confirmed' AND assignee_id = ? AND schedule_date IS NOT NULL AND schedule_date < CURRENT_TIMESTAMP`,
    [userId]
  );

  res.json({
    success: true,
    data: {
      sales: {
        all: formatCounts(salesAll, salesAllLate[0]?.count || 0, salesStatuses),
        my: formatCounts(salesMy, salesMyLate[0]?.count || 0, salesStatuses)
      },
      purchase: {
        all: formatCounts(purchaseAll, purchaseAllLate[0]?.count || 0, purchaseStatuses),
        my: formatCounts(purchaseMy, purchaseMyLate[0]?.count || 0, purchaseStatuses)
      },
      manufacturing: {
        all: formatCounts(manufacturingAll, manufacturingAllLate[0]?.count || 0, manufacturingStatuses),
        my: formatCounts(manufacturingMy, manufacturingMyLate[0]?.count || 0, manufacturingStatuses)
      }
    }
  });
});

module.exports = {
  getDashboardStats
};
