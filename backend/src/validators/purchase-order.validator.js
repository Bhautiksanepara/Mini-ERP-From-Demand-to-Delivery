const { z } = require('zod');

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional()
});

const listPurchaseOrdersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(150).optional(),
    status: z.enum(['Draft', 'Confirmed', 'Partially Received', 'Fully Received', 'Cancelled']).optional(),
    mine: z.coerce.boolean().optional(),
    late: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional()
  }).optional()
});

const purchaseOrderItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  ordered_qty: z.coerce.number().positive(),
  received_qty: z.coerce.number().nonnegative().optional(),
  cost_price: z.coerce.number().min(0).optional()
});

const createPurchaseOrderSchema = z.object({
  body: z.object({
    vendor_id: z.coerce.number().int().positive(),
    vendor_address: z.string().trim().max(255).optional().nullable(),
    responsible_user_id: z.coerce.number().int().positive(),
    scheduled_date: z.string().datetime().optional().nullable(),
    source_sales_order_id: z.coerce.number().int().positive().optional().nullable(),
    items: z.array(purchaseOrderItemSchema).min(1, 'At least one product is required')
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updatePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    vendor_id: z.coerce.number().int().positive().optional(),
    vendor_address: z.string().trim().max(255).optional().nullable(),
    responsible_user_id: z.coerce.number().int().positive().optional(),
    scheduled_date: z.string().datetime().optional().nullable(),
    source_sales_order_id: z.coerce.number().int().positive().optional().nullable(),
    items: z.array(purchaseOrderItemSchema).min(1).optional()
  }).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  query: z.object({}).optional()
});

const receivePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    items: z.array(z.object({
      item_id: z.coerce.number().int().positive(),
      received_qty: z.coerce.number().nonnegative()
    })).min(1, 'At least one received item is required')
  }),
  query: z.object({}).optional()
});

module.exports = {
  createPurchaseOrderSchema,
  idParamSchema,
  listPurchaseOrdersSchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema
};
