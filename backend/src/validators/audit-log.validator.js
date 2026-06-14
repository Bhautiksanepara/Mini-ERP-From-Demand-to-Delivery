const { z } = require('zod');

const listAuditLogsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(150).optional(),
    module_code: z.string().trim().max(50).optional(),
    user_id: z.coerce.number().int().positive().optional(),
    action: z.enum(['Created', 'Updated', 'Deleted', 'Confirmed', 'Delivered', 'Received', 'Produced', 'Cancelled', 'Started']).optional(),
    record_type: z.string().trim().max(80).optional(),
    start_date: z.string().trim().optional(), // ISO date or datetime string
    end_date: z.string().trim().optional(), // ISO date or datetime string
    limit: z.coerce.number().int().positive().max(200).optional(),
    offset: z.coerce.number().int().nonnegative().optional()
  }).optional()
});

module.exports = {
  listAuditLogsSchema
};
