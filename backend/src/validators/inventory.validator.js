const { z } = require('zod');

const listInventorySummarySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(150).optional(),
    low_stock: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional()
  }).optional()
});

const listStockLedgerSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    product_id: z.coerce.number().int().positive().optional(),
    movement_type: z.enum([
      'sales_delivery',
      'purchase_receipt',
      'manufacturing_consumption',
      'manufacturing_production',
      'manual_adjustment'
    ]).optional(),
    reference_type: z.string().trim().max(60).optional(),
    reference_id: z.coerce.number().int().positive().optional(),
    start_date: z.string().trim().optional(),
    end_date: z.string().trim().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional()
  }).optional()
});

const createManualAdjustmentSchema = z.object({
  body: z.object({
    product_id: z.coerce.number().int().positive(),
    quantity_change: z.coerce.number().refine((value) => value !== 0, {
      message: 'Quantity change cannot be zero'
    }),
    note: z.string().trim().max(255).optional().nullable()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

module.exports = {
  createManualAdjustmentSchema,
  listInventorySummarySchema,
  listStockLedgerSchema
};
