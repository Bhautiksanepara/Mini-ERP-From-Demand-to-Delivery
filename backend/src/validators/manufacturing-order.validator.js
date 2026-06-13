const { z } = require('zod');

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional()
});

const listManufacturingOrdersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(150).optional(),
    status: z.enum(['Draft', 'Confirmed', 'In Progress', 'Done', 'Cancelled']).optional(),
    mine: z.coerce.boolean().optional(),
    late: z.coerce.boolean().optional(),
    not_assigned: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional()
  }).optional()
});

const manufacturingComponentSchema = z.object({
  component_product_id: z.coerce.number().int().positive(),
  to_consume_qty: z.coerce.number().nonnegative(),
  consumed_qty: z.coerce.number().nonnegative().optional(),
  unit: z.string().trim().max(30).optional()
});

const manufacturingWorkOrderSchema = z.object({
  operation_name: z.string().trim().min(2).max(120),
  work_center_id: z.coerce.number().int().positive(),
  expected_duration_minutes: z.coerce.number().min(0).optional(),
  real_duration_minutes: z.coerce.number().min(0).optional().nullable(),
  sequence_no: z.coerce.number().int().positive().optional()
});

const manufacturingPayload = {
  finished_product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().max(30).optional(),
  schedule_date: z.string().datetime().optional().nullable(),
  assignee_id: z.coerce.number().int().positive().optional().nullable(),
  bom_id: z.coerce.number().int().positive().optional().nullable(),
  source_sales_order_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(['Draft', 'Confirmed', 'In Progress', 'Done', 'Cancelled']).optional(),
  components: z.array(manufacturingComponentSchema).optional(),
  work_orders: z.array(manufacturingWorkOrderSchema).optional()
};

const createManufacturingOrderSchema = z.object({
  body: z.object(manufacturingPayload),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateManufacturingOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object(manufacturingPayload).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  query: z.object({}).optional()
});

const produceManufacturingOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({
    components: z.array(z.object({
      component_id: z.coerce.number().int().positive(),
      consumed_qty: z.coerce.number().nonnegative()
    })).optional(),
    work_orders: z.array(z.object({
      work_order_id: z.coerce.number().int().positive(),
      real_duration_minutes: z.coerce.number().min(0)
    })).optional()
  }).optional(),
  query: z.object({}).optional()
});

module.exports = {
  createManufacturingOrderSchema,
  idParamSchema,
  listManufacturingOrdersSchema,
  produceManufacturingOrderSchema,
  updateManufacturingOrderSchema
};
