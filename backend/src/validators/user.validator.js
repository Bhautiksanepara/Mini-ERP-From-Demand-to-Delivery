const { z } = require('zod');
const { paginationSortQuery } = require('./list-query.validator');

const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional()
});

const listUsersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(150).optional(),
    role_code: z.string().trim().optional(),
    role_filter: z.enum(['admin', 'non_admin']).optional(),
    is_active: z.string().trim().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
    ...paginationSortQuery
  }).optional()
});

const updateUserSchema = z.object({
  body: z.object({
    full_name: z.string().trim().min(2, 'Name is required').max(120).optional(),
    address: z.string().trim().max(255).optional().nullable(),
    mobile_number: z.string().trim().max(20).optional().nullable(),
    position: z.string().trim().max(100).optional().nullable(),
    is_active: z.boolean().optional(),
    role_codes: z.array(z.string().trim().min(1)).optional(),
    profile_photo: z.string().optional(), // base64 string
    profile_photo_mime: z.string().trim().max(80).optional().nullable()
  }).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).optional()
});

module.exports = {
  idParamSchema,
  listUsersSchema,
  updateUserSchema
};
