const { z } = require('zod');
const { paginationSortQuery } = require('./list-query.validator');

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional()
});

const listSalesOrdersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(150).optional(),
    status: z.enum(['Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 'Cancelled']).optional(),
    mine: z.coerce.boolean().optional(),
    late: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
    ...paginationSortQuery
  }).optional()
});

const salesOrderItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  ordered_qty: z.coerce.number().positive(),
  delivered_qty: z.coerce.number().nonnegative().optional(),
  sales_unit_price: z.coerce.number().min(0).optional()
});

const createSalesOrderSchema = z.object({
  body: z.object({
    customer_id: z.coerce.number().int().positive(),
    customer_address: z.string().trim().max(255).optional().nullable(),
    sales_person_id: z.coerce.number().int().positive(),
    scheduled_date: z.string().datetime().optional().nullable(),
    status: z.enum(['Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 'Cancelled']).optional(),
    items: z.array(salesOrderItemSchema).min(1, 'At least one product is required')
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateSalesOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    customer_id: z.coerce.number().int().positive().optional(),
    customer_address: z.string().trim().max(255).optional().nullable(),
    sales_person_id: z.coerce.number().int().positive().optional(),
    scheduled_date: z.string().datetime().optional().nullable(),
    status: z.enum(['Draft', 'Confirmed', 'Partially Delivered', 'Fully Delivered', 'Cancelled']).optional(),
    items: z.array(salesOrderItemSchema).min(1).optional()
  }).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  query: z.object({}).optional()
});

const deliverSalesOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    items: z.array(z.object({
      item_id: z.coerce.number().int().positive(),
      delivered_qty: z.coerce.number().nonnegative()
    })).min(1, 'At least one delivered item is required')
  }),
  query: z.object({}).optional()
});

module.exports = {
  createSalesOrderSchema,
  deliverSalesOrderSchema,
  idParamSchema,
  listSalesOrdersSchema,
  updateSalesOrderSchema
};
