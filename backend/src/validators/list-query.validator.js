const { z } = require('zod');

const paginationSortQuery = {
  page: z.coerce.number().int().positive().optional(),
  sort_by: z.string().trim().max(50).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional()
};

module.exports = {
  paginationSortQuery
};
