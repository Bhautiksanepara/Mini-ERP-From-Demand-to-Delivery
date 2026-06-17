const { z } = require('zod');
const { paginationSortQuery } = require('./list-query.validator');

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
    product_filter: z.enum(['procure_on_demand', 'low_free_qty']).optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
    ...paginationSortQuery
  }).optional()
});

const contactPayload = {
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().max(255).optional().nullable(),
  email: z.string().trim().email().max(150).optional().nullable(),
  mobile_number: z.string().trim().max(20).optional().nullable()
};

const createCustomerSchema = z.object({
  body: z.object(contactPayload),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateCustomerSchema = z.object({
  body: z.object(contactPayload).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

const createVendorSchema = z.object({
  body: z.object(contactPayload),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateVendorSchema = z.object({
  body: z.object(contactPayload).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

const nullablePositiveId = z.coerce.number().int().positive().optional().nullable();

const productPayload = {
  name: z.string().trim().min(2).max(150),
  sales_price: z.coerce.number().min(0).optional(),
  cost_price: z.coerce.number().min(0).optional(),
  on_hand_qty: z.coerce.number().min(0).optional(),
  procure_on_demand: z.boolean().optional(),
  procurement_method: z.enum(['purchase', 'manufacturing']).optional().nullable(),
  vendor_id: nullablePositiveId,
  bom_id: nullablePositiveId
};

const createProductSchema = z.object({
  body: z.object(productPayload).superRefine((value, ctx) => {
    if (value.procure_on_demand && value.procurement_method === 'purchase' && !value.vendor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vendor_id'],
        message: 'Vendor is required when procurement method is purchase'
      });
    }

    if (value.procure_on_demand && value.procurement_method === 'manufacturing' && !value.bom_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bom_id'],
        message: 'BoM is required when procurement method is manufacturing'
      });
    }
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateProductSchema = z.object({
  body: z.object(productPayload).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

module.exports = {
  createCustomerSchema,
  createProductSchema,
  createVendorSchema,
  idParamSchema,
  listQuerySchema,
  updateCustomerSchema,
  updateProductSchema,
  updateVendorSchema
};
