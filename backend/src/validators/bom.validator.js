const { z } = require('zod');

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional()
});

const listQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(150).optional(),
    finished_product_id: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional()
  }).optional()
});

const bomComponentSchema = z.object({
  component_product_id: z.coerce.number().int().positive(),
  to_consume_qty: z.coerce.number().nonnegative(),
  unit: z.string().trim().max(30).optional()
});

const bomOperationSchema = z.object({
  operation_name: z.string().trim().min(2).max(120),
  work_center_id: z.coerce.number().int().positive(),
  expected_duration_minutes: z.coerce.number().min(0).optional(),
  sequence_no: z.coerce.number().int().positive().optional()
});

const bomPayload = {
  finished_product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().trim().max(30).optional(),
  components: z.array(bomComponentSchema).optional(),
  operations: z.array(bomOperationSchema).optional()
};

const createBomSchema = z.object({
  body: z.object(bomPayload),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateBomSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object(bomPayload).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  query: z.object({}).optional()
});

const createWorkCenterSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(255).optional().nullable()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

module.exports = {
  createBomSchema,
  createWorkCenterSchema,
  idParamSchema,
  listQuerySchema,
  updateBomSchema
};
