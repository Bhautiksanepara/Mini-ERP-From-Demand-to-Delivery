const { AppError } = require('./app-error');

function resolveMovementDirection(quantityChange) {
  return Number(quantityChange) >= 0 ? 'IN' : 'OUT';
}

async function applyStockMovement({
  connection,
  productId,
  movementType,
  quantityChange,
  referenceType,
  referenceId,
  note,
  userId
}) {
  const [productRows] = await connection.execute(
    `SELECT id, on_hand_qty
     FROM products
     WHERE id = ?
       AND deleted_at IS NULL
     LIMIT 1
     FOR UPDATE`,
    [productId]
  );

  const product = productRows[0];

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const quantityBefore = Number(product.on_hand_qty);
  const movementQty = Number(quantityChange);
  const quantityAfter = quantityBefore + movementQty;

  if (quantityAfter < 0) {
    throw new AppError('Stock movement cannot make on hand quantity negative', 400);
  }

  await connection.execute(
    `UPDATE products
     SET on_hand_qty = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [quantityAfter, productId]
  );

  const [ledgerResult] = await connection.execute(
    `INSERT INTO stock_ledger (
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      movementType,
      quantityBefore,
      movementQty,
      quantityAfter,
      resolveMovementDirection(movementQty),
      referenceType,
      referenceId,
      note || null,
      userId
    ]
  );

  return {
    ledger_id: ledgerResult.insertId,
    product_id: productId,
    quantity_before: quantityBefore,
    quantity_change: movementQty,
    quantity_after: quantityAfter,
    movement_direction: resolveMovementDirection(movementQty)
  };
}

module.exports = {
  applyStockMovement
};
